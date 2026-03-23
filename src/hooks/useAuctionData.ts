import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Team = Database['public']['Tables']['teams']['Row'];
type AuctionPlayer = Database['public']['Tables']['auction_players']['Row'];
type AuctionLog = Database['public']['Tables']['auction_log']['Row'];
type RetainedPlayer = Database['public']['Tables']['retained_players']['Row'];

export function useAuctionData() {
  const [teams, setTeams]                     = useState<Team[]>([]);
  const [auctionPlayers, setAuctionPlayers]   = useState<AuctionPlayer[]>([]);
  const [retainedPlayers, setRetainedPlayers] = useState<RetainedPlayer[]>([]);
  const [auctionLog, setAuctionLog]           = useState<AuctionLog[]>([]);
  const [currentPlayer, setCurrentPlayer]     = useState<AuctionPlayer | null>(null);
  const [isLive, setIsLive]                   = useState(false);
  const [loading, setLoading]                 = useState(true);

  const fetchTeams    = useCallback(async () => { const { data } = await supabase.from('teams').select('*').order('short_name'); if (data) setTeams(data); }, []);
  const fetchPlayers  = useCallback(async () => { const { data } = await supabase.from('auction_players').select('*').order('set_number'); if (data) { setAuctionPlayers(data); setCurrentPlayer(data.find(p => p.status === 'current') || null); } }, []);
  const fetchLog      = useCallback(async () => { const { data } = await supabase.from('auction_log').select('*').order('created_at', { ascending: false }).limit(50); if (data) setAuctionLog(data); }, []);
  const fetchRetained = useCallback(async () => { const { data } = await supabase.from('retained_players').select('*'); if (data) setRetainedPlayers(data); }, []);
  const fetchAll      = useCallback(async () => { await Promise.all([fetchTeams(), fetchPlayers(), fetchRetained(), fetchLog()]); setLoading(false); }, [fetchTeams, fetchPlayers, fetchRetained, fetchLog]);

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel('auction-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' },           () => fetchTeams())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_players' }, () => fetchPlayers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_log' },     () => fetchLog())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'retained_players' },() => fetchRetained())
      .subscribe(status => setIsLive(status === 'SUBSCRIBED'));

    // Fallback poll every 15s
    const fallback = setInterval(fetchAll, 15000);

    return () => { supabase.removeChannel(channel); clearInterval(fallback); };
  }, [fetchAll, fetchTeams, fetchPlayers, fetchLog, fetchRetained]);

  const soldPlayersByTeam = useCallback((teamId: string) =>
    auctionPlayers.filter(p => p.status === 'sold' && p.sold_to_team === teamId), [auctionPlayers]);

  const retainedByTeam = useCallback((teamId: string) =>
    retainedPlayers.filter(p => p.team_id === teamId), [retainedPlayers]);

  return { teams, auctionPlayers, retainedPlayers, auctionLog, currentPlayer, isLive, loading, soldPlayersByTeam, retainedByTeam, refetch: fetchAll };
}
