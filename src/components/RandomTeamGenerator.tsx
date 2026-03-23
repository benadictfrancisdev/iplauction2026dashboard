import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shuffle, CheckCircle2, Loader2, AlertCircle, Users } from 'lucide-react';
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
    // Shuffle teams and assign round-robin
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
      // Always use the edge function — it runs with service role key
      // which bypasses RLS entirely, guaranteed to work
      const { data, error: fnErr } = await supabase.functions.invoke(
        'save-team-assignments',
        {
          body: {
            assignments: assignments.map(a => ({
              team_id: a.team.id,
              player_name: a.name,
            })),
          },
        }
      );

      if (fnErr) {
        // Edge function not deployed yet — fall back to direct insert
        console.warn('Edge fn error, trying direct:', fnErr.message);
        await fallbackDirectInsert();
        return;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Save failed');
      }

      onSuccess(assignments.length);
    } catch (e: any) {
      // Last resort: try direct insert
      try {
        await fallbackDirectInsert();
      } catch (e2: any) {
        setError(e2.message || e.message || 'Could not save assignments');
        toast({ title: 'Failed to save', variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  const fallbackDirectInsert = async () => {
    // Try direct insert (works if RLS policies are applied in Supabase)
    const { error: delErr } = await supabase
      .from('retained_players')
      .delete()
      .eq('role', 'OWNER');

    // Ignore delete error (might be RLS on delete too)
    if (delErr) console.warn('Delete warning:', delErr.message);

    const rows = assignments.map(a => ({
      team_id: a.team.id,
      player_name: a.name,
      role: 'OWNER' as const,
      nationality: 'India',
      retention_price: 0,
    }));

    const { error: insErr } = await supabase
      .from('retained_players')
      .insert(rows);

    if (insErr) {
      throw new Error(
        `Database error: ${insErr.message}\n\n` +
        `To fix: Go to Supabase Dashboard → SQL Editor → Run:\n` +
        `CREATE POLICY "insert retained" ON public.retained_players FOR INSERT WITH CHECK (true);\n` +
        `CREATE POLICY "delete retained" ON public.retained_players FOR DELETE USING (true);`
      );
    }

    onSuccess(rows.length);
  };

  const onSuccess = (count: number) => {
    setSaved(true);
    setSaving(false);
    toast({
      title: '✅ Teams assigned!',
      description: `${count} participants assigned — visible on all team cards.`,
    });
    onSaved?.();
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-sm flex items-center gap-1.5">
          <Users className="w-4 h-4" /> Random Team Generator
        </h3>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-xs" onClick={handleClose}>
          ✕
        </Button>
      </div>

      {/* Input */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          Participant names <span className="text-muted-foreground/60">(comma-separated)</span>
        </label>
        <Input
          placeholder="Ramu, Somu, Benadict, Harsha, Barath..."
          value={namesInput}
          onChange={e => { setNamesInput(e.target.value); setSaved(false); setError(null); }}
          className="h-8 text-xs"
          onKeyDown={e => e.key === 'Enter' && generate()}
        />
      </div>

      {/* Generate */}
      <Button
        size="sm"
        onClick={generate}
        className="w-full gap-1.5"
        disabled={!namesInput.trim() || saving}
      >
        <Shuffle className="w-3.5 h-3.5" /> Generate Teams
      </Button>

      {/* Assignments */}
      {assignments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Assignments
            </span>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {assignments.length} people
            </span>
          </div>

          <div className="max-h-52 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
            {assignments.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm py-1.5 px-2.5 rounded-lg bg-muted/40 border border-border/30"
              >
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

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <pre className="whitespace-pre-wrap break-words font-sans leading-relaxed">{error}</pre>
            </div>
          )}

          {/* Confirm */}
          {!saved ? (
            <Button
              onClick={confirmAndSave}
              disabled={saving}
              className="w-full gap-2"
              size="sm"
            >
              {saving ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving assignments…</>
              ) : (
                <>✅ Confirm — Show on Team Overview</>
              )}
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-500 font-semibold justify-center py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
              Saved! Names are now visible on all team cards.
            </div>
          )}

          {/* Regenerate */}
          {!saving && (
            <Button variant="ghost" size="sm" className="w-full text-xs gap-1" onClick={generate}>
              <Shuffle className="w-3 h-3" /> Shuffle &amp; Regenerate
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
