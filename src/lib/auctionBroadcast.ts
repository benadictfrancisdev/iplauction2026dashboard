/**
 * Supabase Broadcast channel — pure WebSocket, bypasses DB WAL pipeline.
 * Latency: ~10-30ms vs ~150-500ms for postgres_changes.
 *
 * Architecture:
 *   Host bids → broadcast event + DB write (parallel)
 *   Viewers receive broadcast → update UI instantly
 *   postgres_changes fires ~200ms later → confirms / corrects any drift
 */
import { supabase } from '@/integrations/supabase/client';

export const BROADCAST_CHANNEL = 'auction-fast';

export type BroadcastEvent =
  | { type: 'BID';        playerId: string; newBid: number; teamId: string | null; timerTs: string }
  | { type: 'SET_PLAYER'; playerId: string; baseBid: number }
  | { type: 'SOLD';       playerId: string; teamId: string; price: number; teamName: string; playerName: string }
  | { type: 'UNSOLD';     playerId: string; playerName: string }
  | { type: 'RESET_BID';  playerId: string; baseBid: number };

/** Singleton broadcast channel — shared across the app */
let _channel: ReturnType<typeof supabase.channel> | null = null;

export function getBroadcastChannel() {
  if (!_channel) {
    _channel = supabase.channel(BROADCAST_CHANNEL, {
      config: { broadcast: { self: true, ack: false } },
    });
    _channel.subscribe();
  }
  return _channel;
}

/** Send a broadcast event (host side) */
export async function emitBid(event: BroadcastEvent) {
  const ch = getBroadcastChannel();
  await ch.send({ type: 'broadcast', event: 'bid', payload: event });
}
