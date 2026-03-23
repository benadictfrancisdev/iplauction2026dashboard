import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getBroadcastChannel, type BroadcastEvent } from '@/lib/auctionBroadcast';
import type { Database } from '@/integrations/supabase/types';

type Team          = Database['public']['Tables']['teams']['Row'];
type AuctionPlayer = Database['public']['Tables']['auction_players']['Row'];
type AuctionLog    = Database['public']['Tables']['auction_log']['Row'];
type RetainedPlayer= Database['public']['Tables']['retained_players']['Row'];

export function useAuctionData() {
  const [teams,           setTeams]           = useState<Team[]>([]);
  const [auctionPlayers,  setAuctionPlayers]  = useState<AuctionPlayer[]>([]);
  const [retainedPlayers, setRetainedPlayers] = useState<RetainedPlayer[]>([]);
  const [auctionLog,      setAuctionLog]      = useState<AuctionLog[]>([]);
  const [currentPlayer,   setCurrentPlayer]   = useState<AuctionPlayer | null>(null);
  const [isLive,          setIsLive]          = useState(false);
  const [loading,         setLoading]         = useState(true);

  // Track last processed bid sequence to reject duplicate broadcasts
  const lastBidTs = useRef<Record<string, string>>({});

  // ── Full fetch fns ────────────────────────────────────────────────────────
  const fetchTeams = useCallback(async () => {
    const { data } = await supabase.from('teams').select('*').order('short_name');
    if (data) setTeams(data);
  }, []);

  const fetchPlayers = useCallback(async () => {
    const { data } = await supabase.from('auction_players').select('*').order('set_number');
    if (data) {
      setAuctionPlayers(data);
      setCurrentPlayer(data.find(p => p.status === 'current') ?? null);
    }
  }, []);

  const fetchLog = useCallback(async () => {
    const { data } = await supabase.from('auction_log').select('*')
      .order('created_at', { ascending: false }).limit(50);
    if (data) setAuctionLog(data);
  }, []);

  const fetchRetained = useCallback(async () => {
    const { data } = await supabase.from('retained_players').select('*');
    if (data) setRetainedPlayers(data);
  }, []);

  // ── BROADCAST handler — < 30ms latency ───────────────────────────────────
  const handleBroadcast = useCallback(({ payload }: { payload: BroadcastEvent }) => {
    const ev = payload;

    switch (ev.type) {
      case 'BID': {
        // Dedup: ignore if we've already processed this exact timestamp
        if (lastBidTs.current[ev.playerId] === ev.timerTs) return;
        lastBidTs.current[ev.playerId] = ev.timerTs;

        setAuctionPlayers(prev => {
          const next = prev.map(p =>
            p.id === ev.playerId
              ? { ...p, current_bid: ev.newBid, leading_team_id: ev.teamId, timer_started_at: ev.timerTs } as any
              : p
          );
          setCurrentPlayer(next.find(p => p.status === 'current') ?? null);
          return next;
        });
        break;
      }

      case 'SET_PLAYER': {
        setAuctionPlayers(prev => {
          const next = prev.map(p =>
            p.id === ev.playerId
              ? { ...p, status: 'current', current_bid: ev.baseBid, leading_team_id: null, timer_started_at: null } as any
              : p.status === 'current' ? { ...p, status: 'available' } : p
          );
          setCurrentPlayer(next.find(p => p.status === 'current') ?? null);
          return next;
        });
        break;
      }

      case 'SOLD': {
        setAuctionPlayers(prev => {
          const next = prev.map(p =>
            p.id === ev.playerId
              ? { ...p, status: 'sold', sold_to_team: ev.teamId, sold_price: ev.price, current_bid: null, leading_team_id: null } as any
              : p
          );
          setCurrentPlayer(next.find(p => p.status === 'current') ?? null);
          return next;
        });
        // Optimistically add to log
        setAuctionLog(prev => [{
          id: `opt-${Date.now()}`,
          player_id: ev.playerId,
          team_id: ev.teamId,
          player_name: ev.playerName,
          team_name: ev.teamName,
          sold_price: ev.price,
          action: 'sold',
          created_at: new Date().toISOString(),
        } as AuctionLog, ...prev].slice(0, 50));
        // Update team budget optimistically
        setTeams(prev => prev.map(t =>
          t.id === ev.teamId ? { ...t, spent_budget: t.spent_budget + ev.price } : t
        ));
        break;
      }

      case 'UNSOLD': {
        setAuctionPlayers(prev => {
          const next = prev.map(p =>
            p.id === ev.playerId
              ? { ...p, status: 'unsold', current_bid: null, leading_team_id: null } as any
              : p
          );
          setCurrentPlayer(next.find(p => p.status === 'current') ?? null);
          return next;
        });
        break;
      }

      case 'RESET_BID': {
        setAuctionPlayers(prev => {
          const next = prev.map(p =>
            p.id === ev.playerId
              ? { ...p, current_bid: ev.baseBid, leading_team_id: null, timer_started_at: null } as any
              : p
          );
          setCurrentPlayer(next.find(p => p.status === 'current') ?? null);
          return next;
        });
        break;
      }
    }
  }, []);

  // ── POSTGRES CHANGES handler — ~200ms, acts as confirmation / drift correction ──
  const handlePlayerChange = useCallback((payload: any) => {
    const { eventType, new: n, old: o } = payload;
    setAuctionPlayers(prev => {
      const next =
        eventType === 'INSERT' ? [...prev, n as AuctionPlayer] :
        eventType === 'DELETE' ? prev.filter(p => p.id !== o.id) :
        // Spread merge so broadcast-applied fields aren't reverted
        prev.map(p => p.id === n.id ? { ...p, ...n } : p);
      setCurrentPlayer(next.find(p => p.status === 'current') ?? null);
      return next;
    });
  }, []);

  const handleTeamChange = useCallback((payload: any) => {
    const { eventType, new: n, old: o } = payload;
    setTeams(prev =>
      eventType === 'INSERT' ? [...prev, n as Team] :
      eventType === 'DELETE' ? prev.filter(t => t.id !== o.id) :
      prev.map(t => t.id === n.id ? { ...t, ...n } : t)
    );
  }, []);

  const handleLogChange = useCallback((payload: any) => {
    const { eventType, new: n, old: o } = payload;
    setAuctionLog(prev => {
      if (eventType === 'INSERT') {
        // Remove optimistic entry if it exists, then add real one
        const filtered = prev.filter(l => !l.id.startsWith('opt-'));
        return [n as AuctionLog, ...filtered].slice(0, 50);
      }
      if (eventType === 'DELETE') return prev.filter(l => l.id !== o.id);
      return prev.map(l => l.id === n.id ? { ...l, ...n } : l);
    });
  }, []);

  const handleRetainedChange = useCallback((payload: any) => {
    const { eventType, new: n, old: o } = payload;
    setRetainedPlayers(prev =>
      eventType === 'INSERT' ? [...prev, n as RetainedPlayer] :
      eventType === 'DELETE' ? prev.filter(r => r.id !== o.id) :
      prev.map(r => r.id === n.id ? { ...r, ...n } : r)
    );
  }, []);

  // ── Setup ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([fetchTeams(), fetchPlayers(), fetchRetained(), fetchLog()])
      .finally(() => setLoading(false));

    // 1. Broadcast channel — instant WebSocket updates
    const broadcastCh = getBroadcastChannel();
    broadcastCh.on('broadcast', { event: 'bid' }, handleBroadcast);

    // 2. Postgres changes — confirmation & non-bid events (set current, retained, etc.)
    const dbCh = supabase
      .channel('auction-db')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' },            handleTeamChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_players' },  handlePlayerChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_log' },      handleLogChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'retained_players' }, handleRetainedChange)
      .subscribe(status => {
        setIsLive(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR') setTimeout(() => dbCh.subscribe(), 2000);
      });

    // 3. Light safety poll — only for consistency, not for speed
    const poll = setInterval(() => { fetchPlayers(); fetchTeams(); }, 60000);

    return () => {
      supabase.removeChannel(dbCh);
      clearInterval(poll);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = useCallback(() =>
    Promise.all([fetchTeams(), fetchPlayers(), fetchRetained(), fetchLog()]),
    [fetchTeams, fetchPlayers, fetchRetained, fetchLog]
  );

  const soldPlayersByTeam = useCallback(
    (id: string) => auctionPlayers.filter(p => p.status === 'sold' && p.sold_to_team === id),
    [auctionPlayers]
  );

  const retainedByTeam = useCallback(
    (id: string) => retainedPlayers.filter(p => p.team_id === id),
    [retainedPlayers]
  );

  return {
    teams, auctionPlayers, retainedPlayers, auctionLog,
    currentPlayer, isLive, loading,
    soldPlayersByTeam, retainedByTeam, refetch,
  };
}
