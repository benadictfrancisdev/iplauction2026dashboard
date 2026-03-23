import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { User, Pencil, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Team           = Database['public']['Tables']['teams']['Row'];
type AuctionPlayer  = Database['public']['Tables']['auction_players']['Row'];
type RetainedPlayer = Database['public']['Tables']['retained_players']['Row'];

function brighten(hex: string): string {
  if (!hex || hex.length < 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if ((0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.4) {
    const f = 1.5;
    const c = (n: number) => Math.min(255, Math.round(n * f + 50)).toString(16).padStart(2, '0');
    return `#${c(r)}${c(g)}${c(b)}`;
  }
  return hex;
}

interface Props {
  team: Team;
  retained: RetainedPlayer[];
  soldPlayers: AuctionPlayer[];
  editable?: boolean;
}

export function TeamCard({ team, retained, soldPlayers, editable = false }: Props) {
  const navigate = useNavigate();

  const remaining    = team.total_budget - team.spent_budget;
  const totalPlayers = soldPlayers.length;
  const overseasLeft = team.overseas_slots - soldPlayers.filter(p => p.country !== 'India').length;
  const slotsLeft    = team.player_slots - totalPlayers;
  const isDark       = document.documentElement.classList.contains('dark') || !document.documentElement.classList.contains('light');
  const textColor    = isDark ? brighten(team.color) : team.color;

  // ── Owners come from retained_players with role='OWNER' ──
  // This reads from the already-fetched retained prop — no new DB column needed
  const ownerRows  = retained.filter(r => r.role === 'OWNER');
  const ownerNames = ownerRows.map(r => r.player_name).join(', ');

  // ── Edit state ──
  const [editing,  setEditing]  = useState(false);
  const [draft,    setDraft]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [saveOk,   setSaveOk]   = useState(false);
  const [saveErr,  setSaveErr]  = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset saveOk when retained prop updates (realtime fired)
  useEffect(() => { setSaveOk(false); }, [retained]);

  function openEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(ownerNames);
    setSaveErr('');
    setSaveOk(false);
    setEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }

  function cancel(e?: React.MouseEvent) {
    e?.stopPropagation();
    setEditing(false);
    setDraft('');
    setSaveErr('');
  }

  async function save(e?: React.MouseEvent) {
    e?.stopPropagation();
    e?.preventDefault();
    if (saving) return;

    setSaving(true);
    setSaveErr('');

    // Call edge function — uses service role, no schema cache issues
    const { data, error: fnErr } = await supabase.functions.invoke('update-owner-name', {
      body: { team_id: team.id, owner_name: draft.trim() },
    });

    setSaving(false);

    if (fnErr || !data?.success) {
      const msg = data?.error || fnErr?.message || 'Save failed';
      setSaveErr(msg);
      console.error('Owner save error:', msg);
    } else {
      setEditing(false);
      setDraft('');
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
      // Realtime on retained_players fires automatically → UI updates for everyone
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    e.stopPropagation();
    if (e.key === 'Enter')  save();
    if (e.key === 'Escape') cancel();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden border border-border/50 hover:border-border/80 transition-all h-full"
      style={{
        background: `linear-gradient(135deg, ${team.color}1a 0%, hsl(var(--card)) 55%)`,
        borderLeft: `4px solid ${team.color}`,
        cursor: editable ? 'default' : 'pointer',
      }}
      onClick={() => { if (!editable && !editing) navigate(`/team/${team.id}`); }}
    >
      <div className="p-3 space-y-2.5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {team.logo_url && (
              <img src={team.logo_url} alt={team.short_name} className="w-8 h-8 object-contain shrink-0" />
            )}
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="font-display font-black text-xs px-2 py-0.5 rounded shrink-0"
                style={{ backgroundColor: team.color, color: '#fff' }}
              >
                {team.short_name}
              </span>
              <span className="text-xs text-muted-foreground truncate hidden sm:block">{team.name}</span>
            </div>
          </div>
          <span className="font-display font-bold text-sm text-foreground shrink-0">
            {totalPlayers}/{team.player_slots}
          </span>
        </div>

        {/* ── Owner name row ── */}
        <div className="min-h-[28px]" onClick={e => e.stopPropagation()}>
          {editable && editing ? (
            /* Edit mode */
            <div className="flex items-center gap-1.5">
              <input
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Owner name(s), comma-separated"
                className={`flex-1 h-7 text-xs px-2 rounded-md bg-background text-foreground border-2 outline-none transition-colors ${saveErr ? 'border-destructive' : 'border-primary'}`}
                style={{ minWidth: 0 }}
              />
              {/* ✓ Save */}
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={save}
                disabled={saving}
                title="Save"
                className="shrink-0 h-7 w-7 flex items-center justify-center rounded-md bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white transition-colors"
              >
                {saving
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Check className="w-3.5 h-3.5" />
                }
              </button>
              {/* ✕ Cancel */}
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={cancel}
                title="Cancel"
                className="shrink-0 h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            /* Display mode */
            <div className="flex items-center gap-1 flex-wrap">
              {ownerRows.length > 0
                ? ownerRows.map((r, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${team.color}22`, color: textColor, border: `1px solid ${team.color}44` }}
                    >
                      <User className="w-2.5 h-2.5 shrink-0" />
                      {r.player_name}
                    </span>
                  ))
                : editable
                  ? (
                    <span
                      className="text-[11px] text-muted-foreground/50 italic cursor-pointer hover:text-muted-foreground transition-colors select-none"
                      onClick={openEdit}
                    >
                      + Add owner name
                    </span>
                  )
                  : null
              }
              {saving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-1" />}
              {editable && !saving && (
                <button
                  onClick={openEdit}
                  title={`Edit ${team.short_name} owner`}
                  className="ml-auto shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-primary/10 transition-colors"
                >
                  {saveOk
                    ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                    : <Pencil className="w-3 h-3 text-muted-foreground/60 hover:text-primary" />
                  }
                </button>
              )}
            </div>
          )}
          {saveErr && <p className="text-[10px] text-destructive mt-0.5">{saveErr}</p>}
        </div>

        {/* ── Budget ── */}
        <div className="leading-none">
          <span className="font-display font-black text-2xl" style={{ color: textColor }}>
            ₹{remaining.toFixed(2)} Cr
          </span>
          <span className="text-xs text-muted-foreground/60 ml-1.5">purse left</span>
        </div>

        {/* ── Stats ── */}
        <div className="flex gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20">
            🏏 {slotsLeft} slots left
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md bg-accent/10 text-accent border border-accent/20">
            ✈️ {overseasLeft} overseas left
          </span>
        </div>

      </div>
    </motion.div>
  );
}
