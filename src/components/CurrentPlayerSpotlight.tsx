import { motion } from 'framer-motion';
import type { Database } from '@/integrations/supabase/types';

type AuctionPlayer = Database['public']['Tables']['auction_players']['Row'];

interface Props {
  player: AuctionPlayer | null;
}

export function CurrentPlayerSpotlight({ player }: Props) {
  if (!player) return null;

  const basePriceInCr = player.base_price >= 100
    ? `₹${(player.base_price / 100).toFixed(2)} Cr`
    : `₹${player.base_price} L`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-lg border-2 border-live/50 bg-card p-4 relative overflow-hidden"
    >
      {/* Animated border glow */}
      <div className="absolute inset-0 rounded-lg border-2 border-live/30 live-pulse pointer-events-none" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-live live-pulse" />
            <span className="text-xs font-bold text-live uppercase tracking-wider">Live — Now Auctioning</span>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">Set {player.set_name || player.set_number}</span>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl text-foreground">{player.player_name}</h2>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span>{player.role}</span>
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
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Base Price</div>
          <div className="font-display font-bold text-xl text-primary">{basePriceInCr}</div>
        </div>
      </div>
    </motion.div>
  );
}
