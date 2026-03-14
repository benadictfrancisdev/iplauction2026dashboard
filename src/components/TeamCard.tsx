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
            <span
              className="font-display font-bold text-sm px-2 py-0.5 rounded"
              style={{ backgroundColor: team.color, color: '#fff' }}
            >
              {team.short_name}
            </span>
            <span className="text-xs text-muted-foreground truncate max-w-[100px]">{team.name}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{totalPlayers}/{team.player_slots}</span>
        </div>

        {/* Budget */}
        <div className="mb-2">
          <span className="font-display font-bold text-xl" style={{ color: team.color }}>
            ₹{remaining.toFixed(2)} Cr
          </span>
          <span className="text-[10px] text-muted-foreground ml-1">purse left</span>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 text-[10px] text-muted-foreground mb-2">
          <span>🏏 {slotsLeft} slots left</span>
          <span>🌍 {overseasLeft} overseas left</span>
          {retained.length > 0 && <span>🔒 {retained.length} retained</span>}
        </div>

        {/* Auction buys */}
        {soldPlayers.length > 0 && (
          <div>
            <div className="text-[10px] text-muted-foreground mb-1">Auction buys ({soldPlayers.length})</div>
            <div className="space-y-0.5 max-h-20 overflow-y-auto scrollbar-thin">
              {soldPlayers.map(p => (
                <div key={p.id} className="text-[11px] flex justify-between">
                  <span className="text-foreground truncate">• {p.player_name}</span>
                  <span className="text-sold text-[10px] ml-1 whitespace-nowrap">₹{p.sold_price?.toFixed(2)} Cr</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
