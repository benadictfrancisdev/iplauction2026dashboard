import { motion, AnimatePresence } from 'framer-motion';
import type { Database } from '@/integrations/supabase/types';

type AuctionLog = Database['public']['Tables']['auction_log']['Row'];

interface Props {
  log: AuctionLog[];
}

export function AuctionLogFeed({ log }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-3 border-b border-border">
        <h3 className="font-display font-bold text-sm text-foreground">Recent Sales</h3>
      </div>
      <div className="p-2 max-h-48 overflow-y-auto scrollbar-thin space-y-1">
        <AnimatePresence>
          {log.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-4">No sales yet</div>
          )}
          {log.slice(0, 5).map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs py-1 px-2 rounded bg-muted/30"
            >
              {entry.action === 'sold' ? (
                <span>
                  <span className="text-sold">✅</span>{' '}
                  <span className="font-medium text-foreground">{entry.player_name}</span>
                  {' → '}
                  <span className="font-medium">{entry.team_name}</span>
                  {' for '}
                  <span className="text-sold font-medium">₹{entry.sold_price?.toFixed(2)} Cr</span>
                </span>
              ) : (
                <span>
                  <span className="text-unsold">❌</span>{' '}
                  <span className="font-medium text-foreground">{entry.player_name}</span>
                  {' — UNSOLD'}
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
