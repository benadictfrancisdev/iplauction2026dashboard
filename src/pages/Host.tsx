import { useState, useMemo } from 'react';
import { useAuctionData } from '@/hooks/useAuctionData';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

const PASSCODE = 'IPL2026';

export default function HostPanel() {
  const [authenticated, setAuthenticated] = useState(() => {
    return localStorage.getItem('host_auth') === 'true';
  });
  const [passcode, setPasscode] = useState('');
  const { toast } = useToast();

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-card border border-border rounded-lg p-8 w-full max-w-sm">
          <h1 className="font-display font-bold text-2xl text-foreground mb-4 text-center">Host Login</h1>
          <p className="text-sm text-muted-foreground mb-4 text-center">Enter the auction passcode</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (passcode === PASSCODE) {
              localStorage.setItem('host_auth', 'true');
              setAuthenticated(true);
            } else {
              toast({ title: 'Wrong passcode', variant: 'destructive' });
            }
          }}>
            <Input
              type="password"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              placeholder="Enter passcode"
              className="mb-4"
            />
            <Button type="submit" className="w-full">Enter Auction Room</Button>
          </form>
        </div>
      </div>
    );
  }

  return <HostDashboard />;
}

function HostDashboard() {
  const {
    teams,
    auctionPlayers,
    currentPlayer,
    auctionLog,
    refetch,
    soldPlayersByTeam,
    retainedByTeam,
  } = useAuctionData();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [soldPrice, setSoldPrice] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredPlayers = useMemo(() => {
    return auctionPlayers.filter(p => {
      const matchSearch = !search || p.player_name.toLowerCase().includes(search.toLowerCase());
      const matchRole = filterRole === 'all' || p.role === filterRole;
      const matchStatus = filterStatus === 'all' || p.status === filterStatus;
      return matchSearch && matchRole && matchStatus;
    }).slice(0, 50);
  }, [auctionPlayers, search, filterRole, filterStatus]);

  const setAsCurrent = async (playerId: string) => {
    // Clear any existing current player
    await supabase.from('auction_players').update({ status: 'available' }).eq('status', 'current');
    await supabase.from('auction_players').update({ status: 'current' }).eq('id', playerId);
    toast({ title: 'Player set as current' });
    refetch();
  };

  const confirmSale = async () => {
    if (!currentPlayer || !selectedTeam || !soldPrice) {
      toast({ title: 'Fill all fields', variant: 'destructive' });
      return;
    }

    const price = parseFloat(soldPrice);
    const team = teams.find(t => t.id === selectedTeam);
    if (!team) return;

    // Update player
    await supabase.from('auction_players').update({
      status: 'sold',
      sold_to_team: selectedTeam,
      sold_price: price,
    }).eq('id', currentPlayer.id);

    // Update team budget
    await supabase.from('teams').update({
      spent_budget: team.spent_budget + price,
    }).eq('id', selectedTeam);

    // Log
    await supabase.from('auction_log').insert({
      player_id: currentPlayer.id,
      team_id: selectedTeam,
      player_name: currentPlayer.player_name,
      team_name: team.short_name,
      sold_price: price,
      action: 'sold',
    });

    setSoldPrice('');
    setSelectedTeam('');
    toast({ title: `${currentPlayer.player_name} sold to ${team.short_name} for ₹${price} Cr!` });
    refetch();
  };

  const markUnsold = async () => {
    if (!currentPlayer) return;

    await supabase.from('auction_players').update({ status: 'unsold' }).eq('id', currentPlayer.id);
    await supabase.from('auction_log').insert({
      player_name: currentPlayer.player_name,
      action: 'unsold',
    });

    toast({ title: `${currentPlayer.player_name} marked as unsold` });
    refetch();
  };

  const undoLastSale = async () => {
    if (auctionLog.length === 0) return;
    const last = auctionLog[0];
    if (last.action !== 'sold') {
      // Just remove the log entry for unsold
      await supabase.from('auction_log').delete().eq('id', last.id);
      if (last.player_id) {
        await supabase.from('auction_players').update({ status: 'available' }).eq('id', last.player_id);
      }
      toast({ title: 'Undo successful' });
      refetch();
      return;
    }

    // Reverse sold
    if (last.player_id) {
      await supabase.from('auction_players').update({
        status: 'available',
        sold_to_team: null,
        sold_price: null,
      }).eq('id', last.player_id);
    }

    if (last.team_id && last.sold_price) {
      const team = teams.find(t => t.id === last.team_id);
      if (team) {
        await supabase.from('teams').update({
          spent_budget: Math.max(0, team.spent_budget - last.sold_price),
        }).eq('id', last.team_id);
      }
    }

    await supabase.from('auction_log').delete().eq('id', last.id);
    toast({ title: `Undid sale of ${last.player_name}` });
    refetch();
  };

  return (
    <div className="min-h-screen p-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Auctioneer Control Panel</h1>
          <p className="text-xs text-muted-foreground">Manage the live auction</p>
        </div>
        <div className="flex gap-2">
          <Link to="/">
            <Button variant="outline" size="sm" className="text-xs">View Dashboard</Button>
          </Link>
          <Button variant="destructive" size="sm" className="text-xs" onClick={undoLastSale}>
            ↩ Undo Last
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Current Player + Sell Controls */}
        <div className="lg:col-span-1 space-y-4">
          {/* Current Player */}
          {currentPlayer ? (
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-live live-pulse" />
                <span className="text-xs font-bold text-live uppercase">Now Auctioning</span>
              </div>
              <h2 className="font-display font-bold text-xl text-foreground">{currentPlayer.player_name}</h2>
              <p className="text-xs text-muted-foreground">
                {currentPlayer.role} | {currentPlayer.country} | Base: ₹{currentPlayer.base_price >= 100 ? `${(currentPlayer.base_price / 100).toFixed(2)} Cr` : `${currentPlayer.base_price} L`}
              </p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Sold To</label>
                  <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.short_name} — ₹{(t.total_budget - t.spent_budget).toFixed(2)} Cr left
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Sold Price (in Cr)</label>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    value={soldPrice}
                    onChange={e => setSoldPrice(e.target.value)}
                    placeholder="e.g. 15.00"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={confirmSale} className="flex-1">✅ Confirm Sale</Button>
                  <Button variant="outline" onClick={markUnsold} className="flex-1">❌ Unsold</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg p-4 text-center text-sm text-muted-foreground">
              No player currently being auctioned. Select one from the player list.
            </div>
          )}

          {/* Team Budget Monitor */}
          <div className="bg-card border border-border rounded-lg p-3">
            <h3 className="font-display font-bold text-sm mb-2">Team Budgets</h3>
            <div className="space-y-1">
              {teams.map(t => {
                const remaining = t.total_budget - t.spent_budget;
                const retained = retainedByTeam(t.id);
                const sold = soldPlayersByTeam(t.id);
                return (
                  <div key={t.id} className="flex items-center justify-between text-xs py-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                      <span className="font-medium">{t.short_name}</span>
                      <span className="text-muted-foreground">({retained.length + sold.length}/{t.player_slots})</span>
                    </div>
                    <span style={{ color: t.color }} className="font-medium">₹{remaining.toFixed(2)} Cr</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Player Browser */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-lg">
            <div className="p-3 border-b border-border">
              <h3 className="font-display font-bold text-sm mb-2">Player Browser</h3>
              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="Search player..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="flex-1 min-w-[200px] h-8 text-xs"
                />
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="BATTER">Batter</SelectItem>
                    <SelectItem value="BOWLER">Bowler</SelectItem>
                    <SelectItem value="ALL-ROUNDER">All-Rounder</SelectItem>
                    <SelectItem value="WICKETKEEPER">Wicketkeeper</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                    <SelectItem value="unsold">Unsold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto scrollbar-thin">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left p-2">Set</th>
                    <th className="text-left p-2">Player</th>
                    <th className="text-left p-2">Country</th>
                    <th className="text-left p-2">Role</th>
                    <th className="text-right p-2">Base</th>
                    <th className="text-center p-2">Status</th>
                    <th className="text-center p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map(p => (
                    <tr key={p.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="p-2">{p.set_name || p.set_number}</td>
                      <td className="p-2 font-medium">{p.player_name}</td>
                      <td className="p-2">{p.country}</td>
                      <td className="p-2">{p.role}</td>
                      <td className="p-2 text-right">₹{p.base_price}L</td>
                      <td className="p-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          p.status === 'available' ? 'bg-primary/20 text-primary' :
                          p.status === 'sold' ? 'bg-sold/20 text-sold' :
                          p.status === 'current' ? 'bg-live/20 text-live' :
                          'bg-unsold/20 text-unsold'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        {p.status === 'available' && (
                          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setAsCurrent(p.id)}>
                            Set Current
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
