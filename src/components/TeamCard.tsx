import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Team           = Database['public']['Tables']['teams']['Row'];
type AuctionPlayer  = Database['public']['Tables']['auction_players']['Row'];
type RetainedPlayer = Database['public']['Tables']['retained_players']['Row'];

function brighten(hex: string): string {
  if (!hex || hex.length < 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if ((0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.4) {
    const f = 1.5;
    const c = (n: number) => Math.min(255, Math.round(n * f + 50)).toString(16).padStart(2, '0');
    return `#${c(r)}${c(g)}${c(b)}`;
  }
  return hex;
}

interface Props {
  team: Team;
  retained: RetainedPlayer[];
  soldPlayers: AuctionPlayer[];
}

export function TeamCard({ team, retained, soldPlayers }: Props) {
  const navigate = useNavigate();

  const remaining    = team.total_budget - team.spent_budget;
  const totalPlayers = soldPlayers.length;
  const overseasLeft = team.overseas_slots - soldPlayers.filter(p => p.country !== 'India').length;
  const slotsLeft    = team.player_slots - totalPlayers;
  const isDark       = document.documentElement.classList.contains('dark') ||
                       !document.documentElement.classList.contains('light');
  const textColor    = isDark ? brighten(team.color) : team.color;

  // Show only actual cricket players from retained (not OWNER role)
  const retainedPlayers = retained.filter(r => r.role !== 'OWNER');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden border border-border/50 hover:border-border transition-all h-full cursor-pointer"
      style={{
        background: `linear-gradient(135deg, ${team.color}1a 0%, hsl(var(--card)) 55%)`,
        borderLeft: `4px solid ${team.color}`,
      }}
      onClick={() => navigate(`/team/${team.id}`)}
    >
      <div className="p-3 space-y-2.5">

        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {team.logo_url && (
              <img src={team.logo_url} alt={team.short_name} className="w-8 h-8 object-contain shrink-0" />
            )}
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="font-display font-black text-xs px-2 py-0.5 rounded shrink-0"
                style={{ backgroundColor: team.color, color: '#fff' }}
              >
                {team.short_name}
              </span>
              <span className="text-xs text-muted-foreground truncate hidden sm:block">{team.name}</span>
            </div>
          </div>
          <span className="font-display font-bold text-sm text-foreground shrink-0">
            {totalPlayers}/{team.player_slots}
          </span>
        </div>

        {/* Budget */}
        <div className="leading-none">
          <span className="font-display font-black text-2xl" style={{ color: textColor }}>
            ₹{remaining.toFixed(2)} Cr
          </span>
          <span className="text-xs text-muted-foreground/60 ml-1.5">purse left</span>
        </div>

        {/* Retained player count badge */}
        {retainedPlayers.length > 0 && (
          <div className="flex items-center gap-1">
            <User className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">
              {retainedPlayers.length} retained
            </span>
          </div>
        )}

        {/* Stats */}
        <div className="flex gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20">
            🏏 {slotsLeft} slots left
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md bg-accent/10 text-accent border border-accent/20">
            ✈️ {overseasLeft} overseas left
          </span>
        </div>

      </div>
    </motion.div>
  );
}
