/**
 * Supabase Broadcast — pure WebSocket, ~10-30ms latency.
 * Bypasses DB WAL pipeline (postgres_changes = ~150-500ms).
 *
 * Flow:
 *   Host bids → emitBid() sends WebSocket broadcast immediately
 *   All viewers receive broadcast → update UI (<30ms)
 *   DB write happens in parallel for persistence
 *   postgres_changes fires ~200ms later as confirmation
 */
import { supabase } from '@/integrations/supabase/client';

export const BROADCAST_CHANNEL = 'ipl-auction-2026';

export type BroadcastEvent =
  | { type: 'BID';        playerId: string; newBid: number; teamId: string | null; timerTs: string }
  | { type: 'SET_PLAYER'; playerId: string; baseBid: number }
  | { type: 'SOLD';       playerId: string; teamId: string; price: number; teamName: string; playerName: string }
  | { type: 'UNSOLD';     playerId: string; playerName: string }
  | { type: 'RESET_BID';  playerId: string; baseBid: number };

// Module-level singleton — one channel shared across the whole app
let _channel: ReturnType<typeof supabase.channel> | null = null;
let _subscribed = false;

export function getBroadcastChannel() {
  if (!_channel) {
    _channel = supabase.channel(BROADCAST_CHANNEL, {
      config: {
        broadcast: {
          self: true,  // host also receives their own broadcasts (for local state sync)
          ack: false,  // fire-and-forget for minimum latency
        },
      },
    });
  }

  if (!_subscribed) {
    _channel.subscribe((status) => {
      _subscribed = status === 'SUBSCRIBED';
      if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        // Reset and reconnect
        _channel = null;
        _subscribed = false;
      }
    });
  }

  return _channel;
}

/** Emit a broadcast event — all connected clients receive this in ~10-30ms */
export async function emitBid(event: BroadcastEvent): Promise<void> {
  try {
    const ch = getBroadcastChannel();
    await ch.send({
      type: 'broadcast',
      event: 'bid',
      payload: event,
    });
  } catch (err) {
    // Non-fatal — DB write still persists the state
    console.warn('Broadcast emit failed (DB write will still sync):', err);
  }
}
