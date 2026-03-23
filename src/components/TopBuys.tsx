import { useMemo } from 'react';
import type { Database } from '@/integrations/supabase/types';

type AuctionPlayer = Database['public']['Tables']['auction_players']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];

interface Props {
  players: AuctionPlayer[];
  teams: Team[];
}

export function TopBuys({ players, teams }: Props) {
  const topBuys = useMemo(() => {
    return players
      .filter(p => p.status === 'sold' && p.sold_price != null)
      .sort((a, b) => (b.sold_price ?? 0) - (a.sold_price ?? 0))
      .slice(0, 3);
  }, [players]);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-3 border-b border-border">
        <h3 className="font-display font-bold text-sm text-foreground">🔥 Top 10 Buys</h3>
      </div>
      <div className="p-2 max-h-48 overflow-y-auto scrollbar-thin space-y-1">
        {topBuys.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">No sales yet</div>
        )}
        {topBuys.map((player, i) => {
          const team = teams.find(t => t.id === player.sold_to_team);
          return (
            <div key={player.id} className="text-xs py-1 px-2 rounded bg-muted/30 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="font-display font-bold text-muted-foreground w-4">{i + 1}</span>
                <span className="font-medium text-foreground">{player.player_name}</span>
                {team && (
                  <span className="font-bold text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: team.color, color: '#fff' }}>
                    {team.short_name}
                  </span>
                )}
              </span>
              <span className="text-sold font-bold">₹{player.sold_price?.toFixed(2)} Cr</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
