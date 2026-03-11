import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Team = Database['public']['Tables']['teams']['Row'];
type AuctionPlayer = Database['public']['Tables']['auction_players']['Row'];
type AuctionLog = Database['public']['Tables']['auction_log']['Row'];
type RetainedPlayer = Database['public']['Tables']['retained_players']['Row'];

export function useAuctionData() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [auctionPlayers, setAuctionPlayers] = useState<AuctionPlayer[]>([]);
  const [retainedPlayers, setRetainedPlayers] = useState<RetainedPlayer[]>([]);
  const [auctionLog, setAuctionLog] = useState<AuctionLog[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<AuctionPlayer | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [teamsRes, playersRes, retainedRes, logRes] = await Promise.all([
      supabase.from('teams').select('*').order('short_name'),
      supabase.from('auction_players').select('*').order('set_number'),
      supabase.from('retained_players').select('*'),
      supabase.from('auction_log').select('*').order('created_at', { ascending: false }).limit(20),
    ]);

    if (teamsRes.data) setTeams(teamsRes.data);
    if (playersRes.data) {
      setAuctionPlayers(playersRes.data);
      const current = playersRes.data.find(p => p.status === 'current');
      setCurrentPlayer(current || null);
    }
    if (retainedRes.data) setRetainedPlayers(retainedRes.data);
    if (logRes.data) setAuctionLog(logRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();

    // Set up realtime subscriptions
    const channel = supabase
      .channel('auction-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        supabase.from('teams').select('*').order('short_name').then(({ data }) => {
          if (data) setTeams(data);
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_players' }, () => {
        supabase.from('auction_players').select('*').order('set_number').then(({ data }) => {
          if (data) {
            setAuctionPlayers(data);
            const current = data.find(p => p.status === 'current');
            setCurrentPlayer(current || null);
          }
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_log' }, () => {
        supabase.from('auction_log').select('*').order('created_at', { ascending: false }).limit(20).then(({ data }) => {
          if (data) setAuctionLog(data);
        });
      })
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    // Auto-refresh every 5 seconds as fallback
    const interval = setInterval(fetchAll, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchAll]);

  const soldPlayersByTeam = useCallback((teamId: string) => {
    return auctionPlayers.filter(p => p.status === 'sold' && p.sold_to_team === teamId);
  }, [auctionPlayers]);

  const retainedByTeam = useCallback((teamId: string) => {
    return retainedPlayers.filter(p => p.team_id === teamId);
  }, [retainedPlayers]);

  return {
    teams,
    auctionPlayers,
    retainedPlayers,
    auctionLog,
    currentPlayer,
    isLive,
    loading,
    soldPlayersByTeam,
    retainedByTeam,
    refetch: fetchAll,
  };
}
