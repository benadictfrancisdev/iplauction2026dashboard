import { motion } from 'framer-motion';
import type { Database } from '@/integrations/supabase/types';

type Team = Database['public']['Tables']['teams']['Row'];
type AuctionPlayer = Database['public']['Tables']['auction_players']['Row'];
type RetainedPlayer = Database['public']['Tables']['retained_players']['Row'];

interface TeamCardProps {
  team: Team;
  retained: RetainedPlayer[];
  soldPlayers: AuctionPlayer[];
}

export function TeamCard({ team, retained, soldPlayers }: TeamCardProps) {
  const remaining = team.total_budget - team.spent_budget;
  const totalPlayers = soldPlayers.length;
  const overseasSold = soldPlayers.filter(p => p.country !== 'India').length;
  const overseasLeft = team.overseas_slots - overseasSold;
  const slotsLeft = team.player_slots - totalPlayers;

  // Top 3 highest bids for this team
  const topBids = [...soldPlayers]
    .filter(p => p.sold_price != null)
    .sort((a, b) => (b.sold_price ?? 0) - (a.sold_price ?? 0))
    .slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg overflow-hidden border border-border/50"
      style={{
        background: `linear-gradient(135deg, ${team.color}22 0%, hsl(220 18% 10%) 100%)`,
        borderLeft: `3px solid ${team.color}`,
      }}
    >
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {team.logo_url && (
              <img
                src={team.logo_url}
                alt={team.short_name}
                className="w-8 h-8 object-contain"
              />
            )}
            <div>
              <span
                className="font-display font-bold text-sm px-2 py-0.5 rounded"
                style={{ backgroundColor: team.color, color: '#fff' }}
              >
                {team.short_name}
              </span>
              <span className="text-sm text-muted-foreground ml-2">{team.name}</span>
            </div>
          </div>
          <span className="font-display font-bold text-sm text-foreground">{totalPlayers}/{team.player_slots}</span>
        </div>

        {/* Budget */}
        <div className="mb-3">
          <span className="font-display font-bold text-2xl" style={{ color: team.color }}>
            ₹{remaining.toFixed(2)} Cr
          </span>
          <span className="text-xs text-muted-foreground ml-1">purse left</span>
        </div>

        {/* Stats row */}
        <div className="flex gap-2 mb-3">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md bg-primary/15 text-primary border border-primary/20">
            🏏 {slotsLeft} slots left
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md bg-accent/15 text-accent border border-accent/20">
            ✈️ {overseasLeft} overseas left
          </span>
        </div>

        {/* Top 3 Highest Bids */}
        {topBids.length > 0 && (
          <div className="border-t border-border/40 pt-2">
            <div className="text-[10px] text-muted-foreground mb-1 font-semibold uppercase tracking-wider">
              Top Buys
            </div>
            <div className="space-y-1">
              {topBids.map((p, i) => (
                <div key={p.id} className="text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="font-display font-bold text-muted-foreground w-4">{i + 1}.</span>
                    <span className="text-foreground font-medium truncate">{p.player_name}</span>
                  </span>
                  <span className="text-sold font-bold text-xs ml-1 whitespace-nowrap">₹{p.sold_price?.toFixed(2)} Cr</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Remaining auction buys */}
        {soldPlayers.length > 3 && (
          <div className="mt-1">
            <div className="text-[10px] text-muted-foreground">
              +{soldPlayers.length - 3} more players
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
