import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { emitBid } from '@/lib/auctionBroadcast';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AuctionTimer, AuctionTimerHandle } from '@/components/AuctionTimer';
import type { Database } from '@/integrations/supabase/types';

type AuctionPlayer = Database['public']['Tables']['auction_players']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];

interface Props { currentPlayer: AuctionPlayer; teams: Team[]; onComplete: () => void; }

function playSoldSound() {
  try {
    const ctx = new AudioContext();
    const hit = ctx.createOscillator(); const hitG = ctx.createGain();
    hit.type = 'square';
    hit.frequency.setValueAtTime(200, ctx.currentTime);
    hit.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
    hitG.gain.setValueAtTime(0.6, ctx.currentTime);
    hitG.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    hit.connect(hitG).connect(ctx.destination); hit.start(); hit.stop(ctx.currentTime + 0.2);
    const chime = ctx.createOscillator(); const chimeG = ctx.createGain();
    chime.type = 'sine';
    [523,659,784].forEach((f,i) => chime.frequency.setValueAtTime(f, ctx.currentTime + 0.25 + i*0.15));
    chimeG.gain.setValueAtTime(0.3, ctx.currentTime + 0.25);
    chimeG.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.9);
    chime.connect(chimeG).connect(ctx.destination);
    chime.start(ctx.currentTime + 0.25); chime.stop(ctx.currentTime + 0.9);
  } catch {}
}

const BID_STEPS = [
  { label: '+5L',   value: 0.05 },
  { label: '+10L',  value: 0.10 },
  { label: '+20L',  value: 0.20 },
  { label: '+25L',  value: 0.25 },
  { label: '+50L',  value: 0.50 },
  { label: '+1 Cr', value: 1.00 },
];

export function BidTracker({ currentPlayer, teams, onComplete }: Props) {
  const { toast }  = useToast();
  const [selectedTeam, setSelectedTeam] = useState('');
  const [soldPrice,    setSoldPrice]    = useState('');
  const [timerExpired, setTimerExpired] = useState(false);
  const [bidding,      setBidding]      = useState(false);
  const timerRef = useRef<AuctionTimerHandle>(null);

  const currentBid    = (currentPlayer as any).current_bid    as number | null;
  const leadingTeamId = (currentPlayer as any).leading_team_id as string | null;
  const basePriceCr   = currentPlayer.base_price / 100;
  const displayBid    = currentBid ?? basePriceCr;
  const leadingTeam   = teams.find(t => t.id === leadingTeamId);

  const handleTimerEnd = useCallback(() => setTimerExpired(true), []);

  // ── Increment bid ────────────────────────────────────────────────────────
  const incrementBid = async (amount: number) => {
    if (timerExpired || bidding) return;
    setBidding(true);

    const newBid   = parseFloat((displayBid + amount).toFixed(2));
    const teamId   = selectedTeam || leadingTeamId;
    const timerTs  = new Date().toISOString();

    // ① Broadcast FIRST — all viewers update in ~10-30ms
    await emitBid({ type: 'BID', playerId: currentPlayer.id, newBid, teamId, timerTs });

    // ② DB write in parallel — persists state
    const { error } = await supabase
      .from('auction_players')
      .update({ current_bid: newBid, leading_team_id: teamId, timer_started_at: timerTs } as any)
      .eq('id', currentPlayer.id);

    setBidding(false);
    if (error) {
      toast({ title: 'DB write failed', description: error.message, variant: 'destructive' });
      return;
    }
    setTimerExpired(false);
    timerRef.current?.start();
  };

  // ── Reset bid ────────────────────────────────────────────────────────────
  const resetBid = async () => {
    await Promise.all([
      emitBid({ type: 'RESET_BID', playerId: currentPlayer.id, baseBid: basePriceCr }),
      supabase.from('auction_players').update(
        { current_bid: basePriceCr, leading_team_id: null, timer_started_at: null } as any
      ).eq('id', currentPlayer.id),
    ]);
    setSelectedTeam('');
    setTimerExpired(false);
    timerRef.current?.reset();
  };

  // ── Confirm sale ─────────────────────────────────────────────────────────
  const confirmSale = async () => {
    const price  = soldPrice ? parseFloat(soldPrice) : displayBid;
    const teamId = selectedTeam || leadingTeamId;
    if (!teamId || !price) {
      toast({ title: 'Select a team first', variant: 'destructive' });
      return;
    }
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    // Broadcast instantly
    await emitBid({
      type: 'SOLD', playerId: currentPlayer.id,
      teamId, price, teamName: team.short_name, playerName: currentPlayer.player_name,
    });

    // Persist all three writes in parallel
    await Promise.all([
      supabase.from('auction_players').update({
        status: 'sold', sold_to_team: teamId, sold_price: price,
        current_bid: null, leading_team_id: null, timer_started_at: null,
      } as any).eq('id', currentPlayer.id),

      supabase.from('teams').update({
        spent_budget: team.spent_budget + price,
      }).eq('id', teamId),

      supabase.from('auction_log').insert({
        player_id: currentPlayer.id, team_id: teamId,
        player_name: currentPlayer.player_name, team_name: team.short_name,
        sold_price: price, action: 'sold',
      }),
    ]);

    setSoldPrice(''); setSelectedTeam(''); setTimerExpired(false);
    timerRef.current?.reset();
    playSoldSound();
    toast({ title: `🏏 ${currentPlayer.player_name} → ${team.short_name} ₹${price.toFixed(2)} Cr` });
    onComplete();
  };

  // ── Mark unsold ──────────────────────────────────────────────────────────
  const markUnsold = async () => {
    await Promise.all([
      emitBid({ type: 'UNSOLD', playerId: currentPlayer.id, playerName: currentPlayer.player_name }),
      supabase.from('auction_players').update(
        { status: 'unsold', current_bid: null, leading_team_id: null, timer_started_at: null } as any
      ).eq('id', currentPlayer.id),
      supabase.from('auction_log').insert({
        player_id: currentPlayer.id, player_name: currentPlayer.player_name, action: 'unsold',
      }),
    ]);
    setTimerExpired(false);
    timerRef.current?.reset();
    toast({ title: `❌ ${currentPlayer.player_name} — unsold` });
    onComplete();
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      {/* Player */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-live live-pulse" />
          <span className="text-xs font-bold text-live uppercase tracking-wider">Now Auctioning</span>
        </div>
        <h2 className="font-display font-bold text-xl text-foreground">{currentPlayer.player_name}</h2>
        <p className="text-xs text-muted-foreground">
          {currentPlayer.role} · {currentPlayer.country} · Base:{' '}
          {currentPlayer.base_price >= 100 ? `₹${basePriceCr.toFixed(2)} Cr` : `₹${currentPlayer.base_price}L`}
        </p>
      </div>

      {/* Live bid */}
      <div className="bg-muted/30 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Current Bid</div>
            <div className="font-display font-bold text-3xl text-live">₹{displayBid.toFixed(2)} Cr</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Leading</div>
            <div className="font-display font-bold text-sm" style={leadingTeam ? { color: leadingTeam.color } : {}}>
              {leadingTeam ? leadingTeam.short_name : '—'}
            </div>
          </div>
        </div>

        {/* Team selector */}
        <Select value={selectedTeam} onValueChange={setSelectedTeam}>
          <SelectTrigger className={`h-8 text-xs ${timerExpired ? 'ring-2 ring-live animate-pulse' : ''}`}>
            <SelectValue placeholder={timerExpired ? '⚠️ Select team!' : 'Select bidding team'} />
          </SelectTrigger>
          <SelectContent>
            {teams.map(t => (
              <SelectItem key={t.id} value={t.id}>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ backgroundColor: t.color }} />
                  {t.short_name} — ₹{(t.total_budget - t.spent_budget).toFixed(2)} Cr left
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Bid increment grid */}
        <div className="grid grid-cols-3 gap-1.5">
          {BID_STEPS.map(s => (
            <Button
              key={s.label}
              size="sm"
              onClick={() => incrementBid(s.value)}
              disabled={timerExpired || bidding}
              className="h-10 font-bold text-sm bg-accent text-accent-foreground hover:bg-accent/80 disabled:opacity-40"
            >
              {bidding ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : s.label}
            </Button>
          ))}
        </div>

        <Button variant="outline" size="sm" className="w-full text-xs" onClick={resetBid}>
          ↺ Reset to Base Price
        </Button>

        <AuctionTimer ref={timerRef} onTimerEnd={handleTimerEnd} />

        {timerExpired && (
          <p className="text-center text-xs font-bold text-live animate-pulse">
            ⏰ Timer ended — confirm sale or mark unsold
          </p>
        )}
      </div>

      {/* Sale */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground block">Final Sale Price (Cr)</label>
        <input
          type="number" step="0.05" min="0"
          value={soldPrice || displayBid.toFixed(2)}
          onChange={e => setSoldPrice(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex gap-2">
          <Button onClick={confirmSale} className="flex-1 font-bold">✅ Confirm Sale</Button>
          <Button variant="outline" onClick={markUnsold} className="flex-1">❌ Unsold</Button>
        </div>
      </div>
    </div>
  );
}
