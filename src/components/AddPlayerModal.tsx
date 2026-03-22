import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Props {
  onAdded: () => void;
}

export function AddPlayerModal({ onAdded }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    player_name: '',
    country: 'India',
    age: '',
    role: '',
    batting_style: '',
    bowling_style: '',
    base_price: '',
    set_number: '',
    set_name: '',
    ipl_caps: '',
    is_capped: false,
  });

  const update = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    if (!form.player_name.trim()) {
      toast({ title: 'Player name is required', variant: 'destructive' });
      return;
    }
    if (!form.role) {
      toast({ title: 'Role is required', variant: 'destructive' });
      return;
    }
    if (!form.base_price || isNaN(parseInt(form.base_price))) {
      toast({ title: 'Valid base price is required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('auction_players').insert({
        player_name: form.player_name.trim(),
        country: form.country || 'India',
        age: form.age ? parseInt(form.age) : null,
        role: form.role,
        batting_style: form.batting_style || null,
        bowling_style: form.bowling_style || null,
        base_price: parseInt(form.base_price),
        set_number: form.set_number ? parseInt(form.set_number) : null,
        set_name: form.set_name || null,
        ipl_caps: form.ipl_caps ? parseInt(form.ipl_caps) : 0,
        is_capped: form.is_capped,
        status: 'available',
      });

      if (error) {
        console.error('Supabase insert error:', error);
        toast({
          title: 'Failed to add player',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({ title: `✅ ${form.player_name} added to auction list` });
      setForm({
        player_name: '', country: 'India', age: '', role: '', batting_style: '',
        bowling_style: '', base_price: '', set_number: '', set_name: '', ipl_caps: '', is_capped: false,
      });
      setOpen(false);
      onAdded();
    } catch (err: any) {
      console.error('Unexpected error:', err);
      toast({
        title: 'Unexpected error',
        description: err?.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">+ Add New Player</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Add New Player</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Player Name *</label>
            <Input
              value={form.player_name}
              onChange={e => update('player_name', e.target.value)}
              placeholder="Player name"
              className="h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Country</label>
              <Input
                value={form.country}
                onChange={e => update('country', e.target.value)}
                placeholder="Country"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Age</label>
              <Input
                type="number"
                value={form.age}
                onChange={e => update('age', e.target.value)}
                placeholder="Age"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Role *</label>
              <Select value={form.role} onValueChange={v => update('role', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BATTER">Batter</SelectItem>
                  <SelectItem value="BOWLER">Bowler</SelectItem>
                  <SelectItem value="ALL-ROUNDER">All-Rounder</SelectItem>
                  <SelectItem value="WICKETKEEPER">Wicketkeeper</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Base Price (₹ Lakh) *</label>
              <Input
                type="number"
                value={form.base_price}
                onChange={e => update('base_price', e.target.value)}
                placeholder="e.g. 200"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Set Number</label>
              <Input
                type="number"
                value={form.set_number}
                onChange={e => update('set_number', e.target.value)}
                placeholder="e.g. 1"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Set Name</label>
              <Input
                value={form.set_name}
                onChange={e => update('set_name', e.target.value)}
                placeholder="e.g. Marquee"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Batting Style</label>
              <Input
                value={form.batting_style}
                onChange={e => update('batting_style', e.target.value)}
                placeholder="e.g. RHB"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Bowling Style</label>
              <Input
                value={form.bowling_style}
                onChange={e => update('bowling_style', e.target.value)}
                placeholder="e.g. Right Arm Fast"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">IPL Caps</label>
              <Input
                type="number"
                value={form.ipl_caps}
                onChange={e => update('ipl_caps', e.target.value)}
                placeholder="0"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Switch checked={form.is_capped} onCheckedChange={v => update('is_capped', v)} />
              <label className="text-xs text-muted-foreground">Capped Player</label>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSubmit} className="flex-1" disabled={loading}>
              {loading && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Add Player
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
