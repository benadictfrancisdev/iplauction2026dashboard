import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { User, Pencil, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Team           = Database['public']['Tables']['teams']['Row'];
type AuctionPlayer  = Database['public']['Tables']['auction_players']['Row'];
type RetainedPlayer = Database['public']['Tables']['retained_players']['Row'];

/* Brighten dark team colours so text is readable on dark cards */
function brighten(hex: string): string {
  if (!hex || hex.length < 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if ((0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.4) {
    const f = 1.5;
    const clamp = (n: number) => Math.min(255, Math.round(n * f + 50)).toString(16).padStart(2, '0');
    return `#${clamp(r)}${clamp(g)}${clamp(b)}`;
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

  const remaining     = team.total_budget - team.spent_budget;
  const totalPlayers  = soldPlayers.length;
  const overseasUsed  = soldPlayers.filter(p => p.country !== 'India').length;
  const overseasLeft  = team.overseas_slots - overseasUsed;
  const slotsLeft     = team.player_slots - totalPlayers;

  const isDark    = document.documentElement.classList.contains('dark') ||
                    !document.documentElement.classList.contains('light');
  const textColor = isDark ? brighten(team.color) : team.color;

  // owner_name is in types now — read it directly, no cast needed
  const propOwner: string = team.owner_name ?? '';

  /* ── Local owner name state ─────────────────────────────── */
  // Initialise from prop; sync whenever prop changes (realtime update)
  const [localOwner, setLocalOwner] = useState<string>(propOwner);
  useEffect(() => { setLocalOwner(team.owner_name ?? ''); }, [team.owner_name]);

  const ownerList = localOwner.split(',').map(s => s.trim()).filter(Boolean);

  /* ── Edit state ─────────────────────────────────────────── */
  const [editing,  setEditing]  = useState(false);
  const [draft,    setDraft]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [saveOk,   setSaveOk]   = useState(false);
  const [saveErr,  setSaveErr]  = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function openEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(localOwner);
    setSaveErr('');
    setSaveOk(false);
    setEditing(true);
    // Focus after render
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

    const value = draft.trim();

    // Optimistic update — show immediately in card
    setLocalOwner(value);
    setEditing(false);
    setSaving(true);
    setSaveErr('');

    const { error } = await supabase
      .from('teams')
      .update({ owner_name: value || null })
      .eq('id', team.id);

    setSaving(false);

    if (error) {
      // Rollback
      setLocalOwner(propOwner);
      setSaveErr(error.message);
      setEditing(true);          // re-open so user can try again
      setDraft(value);
      console.error('TeamCard owner save error:', error);
    } else {
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    e.stopPropagation();
    if (e.key === 'Enter') save();
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

        {/* ── Header: logo · name · count ─── */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {team.logo_url && (
              <img
                src={team.logo_url}
                alt={team.short_name}
                className="w-8 h-8 object-contain shrink-0"
              />
            )}
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span
                className="font-display font-black text-xs px-2 py-0.5 rounded"
                style={{ backgroundColor: team.color, color: '#fff' }}
              >
                {team.short_name}
              </span>
              <span className="text-xs text-muted-foreground truncate hidden sm:block">
                {team.name}
              </span>
            </div>
          </div>
          <span className="font-display font-bold text-sm text-foreground shrink-0">
            {totalPlayers}/{team.player_slots}
          </span>
        </div>

        {/* ── Owner name area ─────────────── */}
        <div
          className="min-h-[28px]"
          onClick={e => e.stopPropagation()}
        >
          {editable && editing ? (
            /* Edit mode */
            <div className="flex items-center gap-1.5">
              <input
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Owner name(s), comma-separated"
                className={`
                  flex-1 h-7 text-xs px-2 rounded-md bg-background text-foreground
                  border-2 outline-none transition-colors
                  ${saveErr ? 'border-destructive' : 'border-primary focus:border-primary/80'}
                `}
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
              {ownerList.length > 0
                ? ownerList.map((name, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${team.color}22`,
                        color: textColor,
                        border: `1px solid ${team.color}44`,
                      }}
                    >
                      <User className="w-2.5 h-2.5 shrink-0" />
                      {name}
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

              {/* Saving spinner (shown after edit closes, while DB writes) */}
              {saving && (
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-1" />
              )}

              {/* Pencil / checkmark button */}
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

          {/* Inline error message */}
          {saveErr && (
            <p className="text-[10px] text-destructive mt-0.5 leading-tight">{saveErr}</p>
          )}
        </div>

        {/* ── Budget ──────────────────────── */}
        <div className="leading-none">
          <span
            className="font-display font-black text-2xl"
            style={{ color: textColor }}
          >
            ₹{remaining.toFixed(2)} Cr
          </span>
          <span className="text-xs text-muted-foreground/60 ml-1.5">purse left</span>
        </div>

        {/* ── Slots & overseas ────────────── */}
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
