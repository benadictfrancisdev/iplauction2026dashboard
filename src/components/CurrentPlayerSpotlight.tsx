import { motion } from 'framer-motion';
import type { Database } from '@/integrations/supabase/types';

type AuctionPlayer = Database['public']['Tables']['auction_players']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];

interface Props {
  player: AuctionPlayer | null;
  teams?: Team[];
  fullscreen?: boolean;
}

export function CurrentPlayerSpotlight({ player, teams, fullscreen }: Props) {
  if (!player) return null;

  const imageUrl = (player as any).image_url as string | null;
  const hasImage = imageUrl && imageUrl !== 'none';
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
      className={`rounded-xl border-2 border-live/50 bg-card relative overflow-hidden ${
        fullscreen ? 'min-h-[60vh]' : 'min-h-[200px]'
      }`}
    >
      {/* Animated border glow */}
      <div className="absolute inset-0 rounded-xl border-2 border-live/30 live-pulse pointer-events-none" />

      <div className={`flex flex-col justify-center h-full ${
        fullscreen ? 'p-10 md:p-16 min-h-[60vh]' : 'p-6 md:p-8'
      }`}>
        {/* Top row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`rounded-full bg-live live-pulse ${fullscreen ? 'w-4 h-4' : 'w-3 h-3'}`} />
            <span className={`font-bold text-live uppercase tracking-wider ${fullscreen ? 'text-lg' : 'text-sm'}`}>
              Live — Now Auctioning
            </span>
          </div>
          <span className={`text-muted-foreground ${fullscreen ? 'text-base' : 'text-sm'}`}>
            Set {player.set_name || player.set_number}
          </span>
        </div>

        {/* Main content */}
        <div className="mt-6 flex flex-col md:flex-row md:items-end justify-between gap-6 flex-1">
          <div className="flex items-center gap-6">
            {hasImage && (
              <img
                src={imageUrl}
                alt={player.player_name}
                className={`rounded-xl object-cover border-2 border-border/50 ${
                  fullscreen ? 'w-40 h-40 md:w-52 md:h-52' : 'w-20 h-20'
                }`}
              />
            )}
            <div>
              <h2 className={`font-display font-bold text-foreground ${
                fullscreen ? 'text-6xl md:text-8xl' : 'text-4xl md:text-5xl'
              }`}>
                {player.player_name}
              </h2>
              <div className={`flex items-center gap-3 mt-3 text-muted-foreground flex-wrap ${
                fullscreen ? 'text-lg' : 'text-sm'
              }`}>
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
          </div>

          <div className="flex items-end gap-8">
            {/* Base Price */}
            <div className="text-right">
              <div className={`text-muted-foreground ${fullscreen ? 'text-sm' : 'text-xs'}`}>Base Price</div>
              <div className={`font-display font-bold text-primary ${fullscreen ? 'text-2xl' : 'text-lg'}`}>
                {basePriceInCr}
              </div>
            </div>

            {/* Current Bid */}
            <div className="text-right">
              <div className={`text-muted-foreground ${fullscreen ? 'text-sm' : 'text-xs'}`}>Current Bid</div>
              <div className={`font-display font-bold text-live ${
                fullscreen ? 'text-5xl md:text-7xl' : 'text-3xl md:text-4xl'
              }`}>
                {currentBidDisplay}
              </div>
              {leadingTeam && (
                <div className={`mt-1 font-medium ${fullscreen ? 'text-base' : 'text-xs'}`} style={{ color: leadingTeam.color }}>
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
