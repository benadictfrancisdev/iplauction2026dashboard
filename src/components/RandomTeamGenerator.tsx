import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shuffle, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);

  const generate = () => {
    const names = namesInput.split(',').map(n => n.trim()).filter(Boolean);
    if (!names.length) {
      toast({ title: 'Enter at least one name', variant: 'destructive' });
      return;
    }
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    setAssignments(names.map((name, i) => ({ name, team: shuffled[i % shuffled.length] })));
    setSaved(false);
    setError(null);
  };

  const confirmAndSave = async () => {
    if (!assignments.length) return;
    setSaving(true);
    setError(null);

    try {
      // Call edge function which uses SERVICE ROLE — bypasses RLS entirely
      const { data, error: fnErr } = await supabase.functions.invoke('save-team-assignments', {
        body: {
          assignments: assignments.map(a => ({
            team_id: a.team.id,
            player_name: a.name,
          })),
        },
      });

      if (fnErr) throw new Error(fnErr.message);
      if (!data?.success) throw new Error(data?.error || 'Save failed');

      setSaved(true);
      toast({
        title: '✅ Teams assigned!',
        description: `${assignments.length} names now visible on every team card.`,
      });
      onSaved?.();
    } catch (e: any) {
      const msg = e.message || 'Unknown error';
      setError(msg);
      toast({ title: 'Failed to save', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setAssignments([]);
    setSaved(false);
    setError(null);
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
        <h3 className="font-display font-bold text-sm">Random Team Generator</h3>
        <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={handleClose}>✕</Button>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          Participant names (comma-separated)
        </label>
        <Input
          placeholder="Ramu, Somu, Ravi, Vikram..."
          value={namesInput}
          onChange={e => { setNamesInput(e.target.value); setSaved(false); }}
          className="h-8 text-xs"
          onKeyDown={e => e.key === 'Enter' && generate()}
        />
      </div>

      <Button size="sm" onClick={generate} className="w-full gap-1.5" disabled={!namesInput.trim()}>
        <Shuffle className="w-3.5 h-3.5" /> Generate Teams
      </Button>

      {assignments.length > 0 && (
        <>
          <div className="space-y-1">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Assignments ({assignments.length})
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {assignments.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2.5 rounded-lg bg-muted/40 border border-border/40">
                  <span className="font-medium text-foreground">{a.name}</span>
                  <span
                    className="font-display font-bold text-xs px-2 py-0.5 rounded ml-2 shrink-0"
                    style={{ backgroundColor: a.team.color, color: '#fff' }}
                  >
                    {a.team.short_name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!saved ? (
            <Button onClick={confirmAndSave} disabled={saving} className="w-full gap-2" size="sm">
              {saving
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                : <>✅ Confirm &amp; Show on Team Cards</>
              }
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-500 font-semibold justify-center py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" /> Saved! Visible on all team cards now.
            </div>
          )}

          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={generate}>
            <Shuffle className="w-3 h-3 mr-1" /> Regenerate
          </Button>
        </>
      )}
    </div>
  );
}
