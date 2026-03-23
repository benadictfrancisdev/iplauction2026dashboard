import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

  // ── Full fetch fns ────────────────────────────────────────────────
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

  // ── Payload handlers — zero-lag instant updates ───────────────────
  const handleTeamChange = useCallback((payload: any) => {
    const { eventType, new: n, old: o } = payload;
    setTeams(prev =>
      eventType === 'INSERT' ? [...prev, n as Team] :
      eventType === 'DELETE' ? prev.filter(t => t.id !== o.id) :
      prev.map(t => t.id === n.id ? { ...t, ...n } : t)
    );
  }, []);

  const handlePlayerChange = useCallback((payload: any) => {
    const { eventType, new: n, old: o } = payload;
    setAuctionPlayers(prev => {
      const next =
        eventType === 'INSERT' ? [...prev, n as AuctionPlayer] :
        eventType === 'DELETE' ? prev.filter(p => p.id !== o.id) :
        prev.map(p => p.id === n.id ? { ...p, ...n } : p);
      // Update currentPlayer from the merged list
      setCurrentPlayer(next.find(p => p.status === 'current') ?? null);
      return next;
    });
  }, []);

  const handleLogChange = useCallback((payload: any) => {
    const { eventType, new: n, old: o } = payload;
    setAuctionLog(prev =>
      eventType === 'INSERT' ? [n as AuctionLog, ...prev].slice(0, 50) :
      eventType === 'DELETE' ? prev.filter(l => l.id !== o.id) :
      prev.map(l => l.id === n.id ? { ...l, ...n } : l)
    );
  }, []);

  const handleRetainedChange = useCallback((payload: any) => {
    const { eventType, new: n, old: o } = payload;
    setRetainedPlayers(prev =>
      eventType === 'INSERT' ? [...prev, n as RetainedPlayer] :
      eventType === 'DELETE' ? prev.filter(r => r.id !== o.id) :
      prev.map(r => r.id === n.id ? { ...r, ...n } : r)
    );
  }, []);

  // ── Setup ─────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([fetchTeams(), fetchPlayers(), fetchRetained(), fetchLog()])
      .finally(() => setLoading(false));

    const ch = supabase
      .channel('auction-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' },           handleTeamChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_players' }, handlePlayerChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_log' },     handleLogChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'retained_players' },handleRetainedChange)
      .subscribe(status => {
        setIsLive(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR') setTimeout(() => ch.subscribe(), 3000);
      });

    // Light fallback — only refetch players/teams every 60s
    const poll = setInterval(() => { fetchPlayers(); fetchTeams(); }, 60000);

    return () => { supabase.removeChannel(ch); clearInterval(poll); };
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
