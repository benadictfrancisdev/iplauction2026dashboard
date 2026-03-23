import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shuffle, CheckCircle2, Loader2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Team = Database['public']['Tables']['teams']['Row'];

interface Props {
  teams: Team[];
  onSaved?: () => void;
}

interface Assignment { name: string; team: Team }

export function RandomTeamGenerator({ teams, onSaved }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [namesInput, setNamesInput] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const generate = () => {
    const names = namesInput.split(',').map(n => n.trim()).filter(Boolean);
    if (!names.length) {
      toast({ title: 'Enter at least one name', variant: 'destructive' });
      return;
    }
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    setAssignments(names.map((name, i) => ({ name, team: shuffled[i % shuffled.length] })));
    setSaved(false);
  };

  const confirmAndSave = async () => {
    if (!assignments.length) return;
    setSaving(true);

    try {
      // Step 1: Clear all existing owner names from every team
      const clearAll = teams.map(t =>
        supabase.from('teams').update({ owner_name: null }).eq('id', t.id)
      );
      await Promise.all(clearAll);

      // Step 2: Group names per team (multiple people can share a team)
      const teamOwners: Record<string, string[]> = {};
      assignments.forEach(a => {
        if (!teamOwners[a.team.id]) teamOwners[a.team.id] = [];
        teamOwners[a.team.id].push(a.name);
      });

      // Step 3: Update each team's owner_name (uses existing UPDATE policy)
      const updates = Object.entries(teamOwners).map(([teamId, names]) =>
        supabase
          .from('teams')
          .update({ owner_name: names.join(', ') })
          .eq('id', teamId)
      );
      const results = await Promise.all(updates);

      const failed = results.find(r => r.error);
      if (failed?.error) throw new Error(failed.error.message);

      setSaved(true);
      toast({
        title: '✅ Teams assigned!',
        description: `${assignments.length} participants assigned and visible on team cards.`,
      });
      onSaved?.();
    } catch (e: any) {
      toast({
        title: 'Failed to save',
        description: e.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setAssignments([]);
    setSaved(false);
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setOpen(true)}>
        <Shuffle className="w-3.5 h-3.5" /> Random Team Generator
      </Button>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-sm flex items-center gap-1.5">
          <Users className="w-4 h-4" /> Random Team Generator
        </h3>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleClose}>✕</Button>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          Participant names <span className="opacity-60">(comma-separated)</span>
        </label>
        <Input
          placeholder="Benadict, Avinash, Dhanush, Harsha..."
          value={namesInput}
          onChange={e => { setNamesInput(e.target.value); setSaved(false); }}
          className="h-8 text-xs"
          onKeyDown={e => e.key === 'Enter' && generate()}
        />
      </div>

      <Button size="sm" onClick={generate} className="w-full gap-1.5" disabled={!namesInput.trim() || saving}>
        <Shuffle className="w-3.5 h-3.5" /> Generate Teams
      </Button>

      {assignments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Assignments</span>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{assignments.length} people</span>
          </div>

          <div className="max-h-52 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
            {assignments.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2.5 rounded-lg bg-muted/40 border border-border/30">
                <span className="font-medium text-foreground truncate pr-2">{a.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {a.team.logo_url && (
                    <img src={a.team.logo_url} alt="" className="w-4 h-4 object-contain" />
                  )}
                  <span
                    className="font-display font-bold text-[11px] px-2 py-0.5 rounded"
                    style={{ backgroundColor: a.team.color, color: '#fff' }}
                  >
                    {a.team.short_name}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {!saved ? (
            <Button onClick={confirmAndSave} disabled={saving} className="w-full gap-2" size="sm">
              {saving
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                : <>✅ Confirm — Show on Team Overview</>
              }
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-500 font-semibold justify-center py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" /> Saved! Visible on all team cards now.
            </div>
          )}

          <Button variant="ghost" size="sm" className="w-full text-xs gap-1" onClick={generate} disabled={saving}>
            <Shuffle className="w-3 h-3" /> Shuffle Again
          </Button>
        </div>
      )}
    </div>
  );
}
