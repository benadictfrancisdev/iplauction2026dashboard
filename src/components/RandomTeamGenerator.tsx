import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shuffle } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Team = Database['public']['Tables']['teams']['Row'];

interface Props {
  teams: Team[];
}

interface Assignment {
  name: string;
  team: Team;
}

export function RandomTeamGenerator({ teams }: Props) {
  const [open, setOpen] = useState(false);
  const [namesInput, setNamesInput] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const generate = () => {
    const names = namesInput.split(',').map(n => n.trim()).filter(Boolean);
    if (names.length === 0 || teams.length === 0) return;

    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
    const result: Assignment[] = names.map((name, i) => ({
      name,
      team: shuffledTeams[i % shuffledTeams.length],
    }));
    setAssignments(result);
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
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setOpen(false); setAssignments([]); }}>
          ✕ Close
        </Button>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          Enter names (comma-separated)
        </label>
        <Input
          placeholder="e.g. Ramu, Somu, Ravi, Vikram, Anbu"
          value={namesInput}
          onChange={e => setNamesInput(e.target.value)}
          className="h-8 text-xs"
        />
      </div>
      <Button size="sm" onClick={generate} className="w-full gap-1.5">
        <Shuffle className="w-3.5 h-3.5" /> Generate Teams
      </Button>

      {assignments.length > 0 && (
        <div className="space-y-1.5 mt-2">
          <div className="text-xs font-bold text-muted-foreground uppercase">Assignments</div>
          {assignments.map((a, i) => (
            <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-md bg-muted/30">
              <span className="font-medium text-foreground">{a.name}</span>
              <span
                className="font-display font-bold text-xs px-2 py-0.5 rounded"
                style={{ backgroundColor: a.team.color, color: '#fff' }}
              >
                {a.team.short_name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
