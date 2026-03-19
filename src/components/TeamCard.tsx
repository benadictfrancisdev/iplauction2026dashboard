import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const remaining = team.total_budget - team.spent_budget;
  const totalPlayers = soldPlayers.length;
  const overseasCount = soldPlayers.filter(p => p.country !== 'India').length;
  const overseasLeft = team.overseas_slots - overseasCount;
  const slotsLeft = team.player_slots - totalPlayers;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg overflow-hidden border border-border/50 cursor-pointer select-none hover:border-border transition-colors h-full"
      style={{
        background: `linear-gradient(135deg, ${team.color}22 0%, hsl(var(--card)) 100%)`,
        borderLeft: `3px solid ${team.color}`,
      }}
      onClick={() => navigate(`/team/${team.id}`)}
    >
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {team.logo_url && (
              <img src={team.logo_url} alt={team.short_name} className="w-8 h-8 object-contain" />
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
          <span className="text-xs text-foreground/60 ml-1">purse left</span>
        </div>

        {/* Stats row */}
        <div className="flex gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md bg-primary/15 text-primary border border-primary/20">
            🏏 {slotsLeft} slots left
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md bg-accent/15 text-accent border border-accent/20">
            ✈️ {overseasLeft} overseas left
          </span>
        </div>
      </div>
    </motion.div>
  );
}
