import { useState, useMemo } from 'react';
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

const ROLE_CATEGORIES = [
  { label: 'Batsmen', keys: ['BATTER', 'BATSMAN', 'BATSMEN', 'BAT'] },
  { label: 'WK', keys: ['WICKETKEEPER', 'WK', 'WICKET-KEEPER', 'WK-BATTER'] },
  { label: 'Allrounder', keys: ['ALL-ROUNDER', 'ALLROUNDER', 'ALL ROUNDER', 'AR'] },
  { label: 'Fast Bowler', keys: ['FAST BOWLER', 'PACER', 'PACE', 'SEAMER', 'FAST'] },
  { label: 'Spinner', keys: ['SPINNER', 'SPIN', 'SPIN BOWLER'] },
];

function categorizeRole(role: string | null): string {
  if (!role) return 'Batsmen';
  const upper = role.toUpperCase().trim();
  // Check if role contains "BOWL" but not "ALL" for generic bowlers
  for (const cat of ROLE_CATEGORIES) {
    if (cat.keys.some(k => upper.includes(k) || upper === k)) return cat.label;
  }
  // Fallback: if contains BOWL, guess based on name
  if (upper.includes('BOWL')) return 'Fast Bowler';
  return 'Batsmen';
}

type PlayerEntry = { name: string; price: number | null; overseas: boolean };

export function TeamCard({ team, retained, soldPlayers }: TeamCardProps) {
  const [expanded, setExpanded] = useState(false);
  const remaining = team.total_budget - team.spent_budget;
  const totalPlayers = soldPlayers.length;
  const overseasCount = soldPlayers.filter(p => p.country !== 'India').length;
  const overseasLeft = team.overseas_slots - overseasCount;
  const slotsLeft = team.player_slots - totalPlayers;

  const topBuys = useMemo(() =>
    [...soldPlayers]
      .filter(p => p.sold_price != null)
      .sort((a, b) => (b.sold_price ?? 0) - (a.sold_price ?? 0))
      .slice(0, 3),
    [soldPlayers]
  );

  const roleGroups = useMemo(() => {
    // Combine retained + sold into unified list
    const all: (PlayerEntry & { role: string })[] = [
      ...retained.map(p => ({
        name: p.player_name,
        price: p.retention_price,
        overseas: p.nationality !== 'India' && p.nationality != null,
        role: categorizeRole(p.role),
      })),
      ...soldPlayers.map(p => ({
        name: p.player_name,
        price: p.sold_price,
        overseas: p.country !== 'India' && p.country != null,
        role: categorizeRole(p.role),
      })),
    ];

    return ROLE_CATEGORIES.map(cat => ({
      label: cat.label,
      players: all
        .filter(p => p.role === cat.label)
        .sort((a, b) => (b.price ?? 0) - (a.price ?? 0)),
    })).filter(g => g.players.length > 0);
  }, [retained, soldPlayers]);

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

              {/* Summary stats */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                <span className="text-muted-foreground">
                  Slots Filled: <span className="text-foreground font-bold">{totalPlayers + retained.length}</span>
                </span>
                <span className="text-muted-foreground">
                  Overseas: <span className="text-foreground font-bold">
                    {overseasCount + retained.filter(r => r.nationality !== 'India' && r.nationality != null).length}
                  </span>
                </span>
              </div>

              {/* Top 3 Buys */}
              {topBuys.length > 0 && (
                <div className="text-[11px]">
                  <span className="text-muted-foreground">Top Buys: </span>
                  {topBuys.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && <span className="text-muted-foreground"> · </span>}
                      <span className="text-foreground font-semibold">{p.player_name}</span>
                      <span className="text-muted-foreground"> (₹{p.sold_price?.toFixed(1)})</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Role-wise breakdown */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                {roleGroups.map(group => (
                  <div
                    key={group.label}
                    className="rounded-md border border-border/30 p-2"
                    style={{ background: `${team.color}08` }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {group.label}
                      </span>
                      <span
                        className="text-[10px] font-bold rounded px-1.5 py-0.5"
                        style={{ backgroundColor: `${team.color}30`, color: team.color }}
                      >
                        {group.players.length}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {group.players.map((p, i) => (
                        <div key={i} className="text-[11px] flex items-center justify-between">
                          <span className="flex items-center gap-1 text-foreground truncate">
                            {p.overseas && <span className="text-[9px]">✈️</span>}
                            {p.name}
                          </span>
                          {p.price != null && (
                            <span className="font-bold whitespace-nowrap ml-1" style={{ color: team.color }}>
                              ₹{p.price} Cr
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
