import type { Database } from '@/integrations/supabase/types';

type Team = Database['public']['Tables']['teams']['Row'];
type AuctionPlayer = Database['public']['Tables']['auction_players']['Row'];
type RetainedPlayer = Database['public']['Tables']['retained_players']['Row'];

interface Props {
  teams: Team[];
  soldPlayersByTeam: (teamId: string) => AuctionPlayer[];
  retainedByTeam: (teamId: string) => RetainedPlayer[];
}

export function SquadSummary({ teams, soldPlayersByTeam, retainedByTeam }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-x-auto">
      <div className="p-3 border-b border-border">
        <h3 className="font-display font-bold text-sm text-foreground">Squad Summary</h3>
        <p className="text-[10px] text-muted-foreground">Retained players + auction picks</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left p-2 font-medium">Team</th>
            <th className="text-center p-2 font-medium">Players</th>
            <th className="text-center p-2 font-medium">Retained</th>
            <th className="text-center p-2 font-medium">Bought</th>
            <th className="text-right p-2 font-medium">Spent</th>
            <th className="text-right p-2 font-medium">Remaining</th>
          </tr>
        </thead>
        <tbody>
          {teams.map(team => {
            const retained = retainedByTeam(team.id);
            const sold = soldPlayersByTeam(team.id);
            const total = retained.length + sold.length;
            return (
              <tr key={team.id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="p-2 font-medium">
                  <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: team.color }} />
                  {team.short_name}
                </td>
                <td className="text-center p-2">{total}/{team.player_slots}</td>
                <td className="text-center p-2">{retained.length}</td>
                <td className="text-center p-2">{sold.length}</td>
                <td className="text-right p-2">₹{team.spent_budget.toFixed(2)} Cr</td>
                <td className="text-right p-2 font-medium" style={{ color: team.color }}>
                  ₹{(team.total_budget - team.spent_budget).toFixed(2)} Cr
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
