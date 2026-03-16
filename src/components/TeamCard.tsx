import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Database } from '@/integrations/supabase/types';
import { ChevronDown } from 'lucide-react';

type Team = Database['public']['Tables']['teams']['Row'];
type AuctionPlayer = Database['public']['Tables']['auction_players']['Row'];
type RetainedPlayer = Database['public']['Tables']['retained_players']['Row'];

interface TeamCardProps {
  team: Team;
  retained: RetainedPlayer[];
  soldPlayers: AuctionPlayer[];
}

export function TeamCard({ team, retained, soldPlayers }: TeamCardProps) {
  const [expanded, setExpanded] = useState(false);
  const remaining = team.total_budget - team.spent_budget;
  const totalPlayers = soldPlayers.length;
  const overseasSold = soldPlayers.filter(p => p.country !== 'India').length;
  const overseasLeft = team.overseas_slots - overseasSold;
  const slotsLeft = team.player_slots - totalPlayers;

  const topBids = [...soldPlayers]
    .filter(p => p.sold_price != null)
    .sort((a, b) => (b.sold_price ?? 0) - (a.sold_price ?? 0))
    .slice(0, 3);

  const hasSquad = retained.length > 0 || soldPlayers.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg overflow-hidden border border-border/50 cursor-pointer select-none"
      style={{
        background: `linear-gradient(135deg, ${team.color}22 0%, hsl(220 18% 10%) 100%)`,
        borderLeft: `3px solid ${team.color}`,
      }}
      onClick={() => hasSquad && setExpanded(!expanded)}
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
          <div className="flex items-center gap-1.5">
            <span className="font-display font-bold text-sm text-foreground">{totalPlayers}/{team.player_slots}</span>
            {hasSquad && (
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              />
            )}
          </div>
        </div>

        {/* Budget */}
        <div className="mb-3">
          <span className="font-display font-bold text-2xl" style={{ color: team.color }}>
            ₹{remaining.toFixed(2)} Cr
          </span>
          <span className="text-xs text-muted-foreground ml-1">purse left</span>
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

      {/* Expanded Squad Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              <div className="border-t border-border/40 pt-2" />

              {/* Retained Players */}
              {retained.length > 0 && (
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1.5 font-semibold uppercase tracking-wider">
                    Retained ({retained.length})
                  </div>
                  <div className="space-y-1">
                    {retained.map(p => (
                      <div key={p.id} className="text-xs flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <span className="text-foreground font-medium">{p.player_name}</span>
                          <span className="text-muted-foreground">· {p.role}</span>
                          {p.nationality && p.nationality !== 'India' && (
                            <span className="text-[10px] text-accent">✈️</span>
                          )}
                        </span>
                        {p.retention_price != null && (
                          <span className="text-primary font-bold whitespace-nowrap">₹{p.retention_price} Cr</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bought Players */}
              {soldPlayers.length > 0 && (
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1.5 font-semibold uppercase tracking-wider">
                    Bought ({soldPlayers.length})
                  </div>
                  <div className="space-y-1">
                    {[...soldPlayers]
                      .sort((a, b) => (b.sold_price ?? 0) - (a.sold_price ?? 0))
                      .map(p => (
                        <div key={p.id} className="text-xs flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: team.color }} />
                            <span className="text-foreground font-medium">{p.player_name}</span>
                            <span className="text-muted-foreground">· {p.role}</span>
                            {p.country && p.country !== 'India' && (
                              <span className="text-[10px] text-accent">✈️</span>
                            )}
                          </span>
                          <span className="font-bold whitespace-nowrap" style={{ color: team.color }}>
                            ₹{p.sold_price?.toFixed(2)} Cr
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
