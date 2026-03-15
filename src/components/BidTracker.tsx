import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

function playSoldSound() {
  const ctx = new AudioContext();
  // Gavel hit — sharp percussive knock
  const hit = ctx.createOscillator();
  const hitGain = ctx.createGain();
  hit.type = 'square';
  hit.frequency.setValueAtTime(200, ctx.currentTime);
  hit.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
  hitGain.gain.setValueAtTime(0.6, ctx.currentTime);
  hitGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  hit.connect(hitGain).connect(ctx.destination);
  hit.start(ctx.currentTime);
  hit.stop(ctx.currentTime + 0.2);

  // Celebratory chime
  const chime = ctx.createOscillator();
  const chimeGain = ctx.createGain();
  chime.type = 'sine';
  chime.frequency.setValueAtTime(523, ctx.currentTime + 0.25);
  chime.frequency.setValueAtTime(659, ctx.currentTime + 0.4);
  chime.frequency.setValueAtTime(784, ctx.currentTime + 0.55);
  chimeGain.gain.setValueAtTime(0.3, ctx.currentTime + 0.25);
  chimeGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.9);
  chime.connect(chimeGain).connect(ctx.destination);
  chime.start(ctx.currentTime + 0.25);
  chime.stop(ctx.currentTime + 0.9);
}

type AuctionPlayer = Database['public']['Tables']['auction_players']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];

interface Props {
  currentPlayer: AuctionPlayer;
  teams: Team[];
  onComplete: () => void;
}

const BID_INCREMENTS = [
  { label: '+5L', value: 0.05 },
  { label: '+10L', value: 0.10 },
  { label: '+20L', value: 0.20 },
  { label: '+25L', value: 0.25 },
  { label: '+50L', value: 0.50 },
  { label: '+1 Cr', value: 1.00 },
];

export function BidTracker({ currentPlayer, teams, onComplete }: Props) {
  const { toast } = useToast();
  const [selectedTeam, setSelectedTeam] = useState('');
  const [soldPrice, setSoldPrice] = useState('');

  const currentBid = (currentPlayer as any).current_bid as number | null;
  const leadingTeamId = (currentPlayer as any).leading_team_id as string | null;
  const basePriceCr = currentPlayer.base_price / 100;
  const displayBid = currentBid ?? basePriceCr;

  const leadingTeam = teams.find(t => t.id === leadingTeamId);

  const incrementBid = async (amount: number) => {
    const newBid = displayBid + amount;
    await supabase.from('auction_players').update({
      current_bid: newBid,
      leading_team_id: selectedTeam || leadingTeamId,
    } as any).eq('id', currentPlayer.id);
    onComplete();
  };

  const resetBid = async () => {
    await supabase.from('auction_players').update({
      current_bid: basePriceCr,
      leading_team_id: null,
    } as any).eq('id', currentPlayer.id);
    setSelectedTeam('');
    onComplete();
  };

  const confirmSale = async () => {
    const price = soldPrice ? parseFloat(soldPrice) : displayBid;
    const teamId = selectedTeam || leadingTeamId;
    if (!teamId || !price) {
      toast({ title: 'Select a team and ensure bid is set', variant: 'destructive' });
      return;
    }

    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    await supabase.from('auction_players').update({
      status: 'sold',
      sold_to_team: teamId,
      sold_price: price,
      current_bid: null,
      leading_team_id: null,
    } as any).eq('id', currentPlayer.id);

    await supabase.from('teams').update({
      spent_budget: team.spent_budget + price,
    }).eq('id', teamId);

    await supabase.from('auction_log').insert({
      player_id: currentPlayer.id,
      team_id: teamId,
      player_name: currentPlayer.player_name,
      team_name: team.short_name,
      sold_price: price,
      action: 'sold',
    });

    setSoldPrice('');
    setSelectedTeam('');
    toast({ title: `${currentPlayer.player_name} sold to ${team.short_name} for ₹${price.toFixed(2)} Cr!` });
    onComplete();
  };

  const markUnsold = async () => {
    await supabase.from('auction_players').update({
      status: 'unsold',
      current_bid: null,
      leading_team_id: null,
    } as any).eq('id', currentPlayer.id);

    await supabase.from('auction_log').insert({
      player_name: currentPlayer.player_name,
      action: 'unsold',
    });

    toast({ title: `${currentPlayer.player_name} marked as unsold` });
    onComplete();
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      {/* Player Info */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-live live-pulse" />
          <span className="text-xs font-bold text-live uppercase">Now Auctioning</span>
        </div>
        <h2 className="font-display font-bold text-xl text-foreground">{currentPlayer.player_name}</h2>
        <p className="text-xs text-muted-foreground">
          {currentPlayer.role} | {currentPlayer.country} | Base: ₹{currentPlayer.base_price >= 100 ? `${basePriceCr.toFixed(2)} Cr` : `${currentPlayer.base_price} L`}
        </p>
      </div>

      {/* Live Bid Tracker */}
      <div className="bg-muted/30 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Current Bid</div>
            <div className="font-display font-bold text-2xl text-live">₹{displayBid.toFixed(2)} Cr</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Leading Bidder</div>
            <div className="font-display font-bold text-sm" style={leadingTeam ? { color: leadingTeam.color } : {}}>
              {leadingTeam ? leadingTeam.short_name : 'None'}
            </div>
          </div>
        </div>

        {/* Team selector for bid */}
        <Select value={selectedTeam} onValueChange={setSelectedTeam}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select bidding team" />
          </SelectTrigger>
          <SelectContent>
            {teams.map(t => (
              <SelectItem key={t.id} value={t.id}>
                {t.short_name} — ₹{(t.total_budget - t.spent_budget).toFixed(2)} Cr left
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Bid Increment Buttons */}
        <div className="grid grid-cols-3 gap-2">
          {BID_INCREMENTS.map(inc => (
            <Button
              key={inc.label}
              size="sm"
              onClick={() => incrementBid(inc.value)}
              className="h-10 font-bold text-sm bg-accent text-accent-foreground hover:bg-accent/80"
            >
              {inc.label}
            </Button>
          ))}
        </div>

        <Button variant="outline" size="sm" className="w-full text-xs" onClick={resetBid}>
          ↺ Reset Bid to Base
        </Button>
      </div>

      {/* Confirm Sale */}
      <div className="space-y-2">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Sold Price (auto-filled, editable)</label>
          <input
            type="number"
            step="0.05"
            min="0"
            value={soldPrice || displayBid.toFixed(2)}
            onChange={e => setSoldPrice(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={confirmSale} className="flex-1">✅ Confirm Sale</Button>
          <Button variant="outline" onClick={markUnsold} className="flex-1">❌ Unsold</Button>
        </div>
      </div>
    </div>
  );
}
