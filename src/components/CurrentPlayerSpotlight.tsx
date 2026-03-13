import { motion } from 'framer-motion';
import type { Database } from '@/integrations/supabase/types';

type AuctionPlayer = Database['public']['Tables']['auction_players']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];

interface Props {
  player: AuctionPlayer | null;
  teams?: Team[];
}

export function CurrentPlayerSpotlight({ player, teams }: Props) {
  if (!player) return null;

  const basePriceInCr = player.base_price >= 100
    ? `₹${(player.base_price / 100).toFixed(2)} Cr`
    : `₹${player.base_price} L`;

  const currentBid = (player as any).current_bid as number | null;
  const leadingTeamId = (player as any).leading_team_id as string | null;
  const leadingTeam = teams?.find(t => t.id === leadingTeamId);

  const currentBidDisplay = currentBid
    ? `₹${currentBid.toFixed(2)} Cr`
    : basePriceInCr;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl border-2 border-live/50 bg-card relative overflow-hidden"
      style={{ minHeight: '200px' }}
    >
      {/* Animated border glow */}
      <div className="absolute inset-0 rounded-xl border-2 border-live/30 live-pulse pointer-events-none" />

      <div className="p-6 md:p-8 flex flex-col justify-between h-full">
        {/* Top row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-live live-pulse" />
            <span className="text-sm font-bold text-live uppercase tracking-wider">Live — Now Auctioning</span>
          </div>
          <span className="text-sm text-muted-foreground">Set {player.set_name || player.set_number}</span>
        </div>

        {/* Main content */}
        <div className="mt-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-4xl md:text-5xl text-foreground">{player.player_name}</h2>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
              <span className="font-medium text-foreground/80">{player.role}</span>
              <span>•</span>
              <span>{player.country}</span>
              {player.age && (
                <>
                  <span>•</span>
                  <span>Age {player.age}</span>
                </>
              )}
              {player.ipl_caps ? (
                <>
                  <span>•</span>
                  <span>{player.ipl_caps} IPL Caps</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex items-end gap-6">
            {/* Base Price */}
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Base Price</div>
              <div className="font-display font-bold text-lg text-primary">{basePriceInCr}</div>
            </div>

            {/* Current Bid - prominent */}
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Current Bid</div>
              <div className="font-display font-bold text-3xl md:text-4xl text-live">
                {currentBidDisplay}
              </div>
              {leadingTeam && (
                <div className="text-xs mt-1 font-medium" style={{ color: leadingTeam.color }}>
                  ▲ {leadingTeam.short_name}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
