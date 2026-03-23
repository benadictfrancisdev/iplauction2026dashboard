import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { User, Pencil, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Team           = Database['public']['Tables']['teams']['Row'];
type AuctionPlayer  = Database['public']['Tables']['auction_players']['Row'];
type RetainedPlayer = Database['public']['Tables']['retained_players']['Row'];

function brighten(hex: string): string {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  if ((0.299*r+0.587*g+0.114*b)/255 < 0.35) {
    const f=1.6;
    const c=(n:number)=>Math.min(255,Math.round(n*f+40)).toString(16).padStart(2,'0');
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

export function TeamCard({ team, retained, soldPlayers, editable=false }: Props) {
  const navigate = useNavigate();

  const remaining    = team.total_budget - team.spent_budget;
  const totalPlayers = soldPlayers.length;
  const overseasLeft = team.overseas_slots - soldPlayers.filter(p=>p.country!=='India').length;
  const slotsLeft    = team.player_slots - totalPlayers;

  const isDark    = document.documentElement.classList.contains('dark') ||
                    !document.documentElement.classList.contains('light');
  const textColor = isDark ? brighten(team.color) : team.color;

  /* ── Local owner name — updates immediately on save, syncs from prop ── */
  const propOwner = (team as any).owner_name as string | null ?? '';
  const [localOwner, setLocalOwner] = useState(propOwner);

  // Keep local in sync when realtime pushes new prop value
  useEffect(() => {
    setLocalOwner((team as any).owner_name ?? '');
  }, [(team as any).owner_name]);

  const owners = localOwner ? localOwner.split(',').map(s=>s.trim()).filter(Boolean) : [];

  /* ── Edit state ───────────────────────────────────────────────────── */
  const [editing,   setEditing]   = useState(false);
  const [draft,     setDraft]     = useState('');
  const [saving,    setSaving]    = useState(false);
  const [flashOk,   setFlashOk]   = useState(false);
  const inputRef  = useRef<HTMLInputElement>(null);
  const debounce  = useRef<ReturnType<typeof setTimeout>>();

  const openEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(localOwner);
    setEditing(true);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 30);
  };

  const cancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    clearTimeout(debounce.current);
    setEditing(false);
    setDraft('');
  };

  /* Core save — updates local state IMMEDIATELY then writes to DB */
  const commitSave = useCallback(async (value: string) => {
    clearTimeout(debounce.current);
    const trimmed = value.trim();

    // 1. Update local display INSTANTLY — no waiting for realtime
    setLocalOwner(trimmed);
    setEditing(false);
    setSaving(true);

    // 2. Persist to DB
    const { error } = await supabase
      .from('teams')
      .update({ owner_name: trimmed || null } as any)
      .eq('id', team.id);

    setSaving(false);

    if (error) {
      // Rollback local on error
      setLocalOwner(propOwner);
      console.error('Owner save failed:', error.message);
    } else {
      // Flash success checkmark
      setFlashOk(true);
      setTimeout(() => setFlashOk(false), 1800);
    }
  }, [team.id, propOwner]);

  /* Debounced auto-save while typing (800 ms idle) */
  const handleDraftChange = (val: string) => {
    setDraft(val);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => commitSave(val), 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key==='Enter')  commitSave(draft);
    if (e.key==='Escape') cancelEdit();
  };

  /* Click ✓ button */
  const handleTickClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    commitSave(draft);
  };

  return (
    <motion.div
      initial={{ opacity:0, y:16 }}
      animate={{ opacity:1, y:0 }}
      className="rounded-lg overflow-hidden border border-border/50 hover:border-border transition-colors h-full"
      style={{
        background: `linear-gradient(135deg,${team.color}22 0%,hsl(var(--card)) 100%)`,
        borderLeft: `3px solid ${team.color}`,
        cursor: editable ? 'default' : 'pointer',
      }}
      onClick={() => !editable && !editing && navigate(`/team/${team.id}`)}
    >
      <div className="p-3 space-y-2">

        {/* ── Team header ───────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {team.logo_url && (
              <img src={team.logo_url} alt={team.short_name} className="w-8 h-8 object-contain" />
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="font-display font-bold text-sm px-2 py-0.5 rounded"
                style={{ backgroundColor: team.color, color:'#fff' }}
              >
                {team.short_name}
              </span>
              <span className="text-xs text-muted-foreground hidden sm:inline">{team.name}</span>
            </div>
          </div>
          <span className="font-display font-bold text-sm text-foreground shrink-0">
            {totalPlayers}/{team.player_slots}
          </span>
        </div>

        {/* ── Owner name row ────────────────────────── */}
        <div className="min-h-[28px]" onClick={e=>e.stopPropagation()}>
          <AnimatePresence mode="wait">
            {editable && editing ? (
              /* ── Edit mode ── */
              <motion.div
                key="edit"
                initial={{ opacity:0, y:-4 }}
                animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-4 }}
                transition={{ duration:0.12 }}
                className="flex items-center gap-1"
              >
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={e => handleDraftChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Owner names, comma-separated"
                  className="flex-1 h-7 text-xs px-2 rounded-md border-2 border-primary bg-background text-foreground outline-none"
                  style={{ minWidth:0 }}
                />
                {/* ✓ Tick — saves immediately */}
                <button
                  onMouseDown={e => e.preventDefault()} // prevent blur before click
                  onClick={handleTickClick}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                  title="Save"
                >
                  {saving
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Check className="w-3.5 h-3.5" />
                  }
                </button>
                {/* ✕ Cancel */}
                <button
                  onMouseDown={e => e.preventDefault()}
                  onClick={cancelEdit}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ) : (
              /* ── Display mode ── */
              <motion.div
                key="display"
                initial={{ opacity:0 }}
                animate={{ opacity:1 }}
                exit={{ opacity:0 }}
                transition={{ duration:0.1 }}
                className="flex items-center gap-1 flex-wrap"
              >
                {owners.length > 0 ? (
                  owners.map((name,i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor:`${team.color}28`,
                        color: textColor,
                        border:`1px solid ${team.color}55`,
                      }}
                    >
                      <User className="w-2.5 h-2.5 shrink-0" />
                      {name}
                    </span>
                  ))
                ) : editable ? (
                  <span
                    className="text-[11px] text-muted-foreground/40 italic cursor-pointer hover:text-muted-foreground transition-colors"
                    onClick={openEdit}
                  >
                    + Add owner name
                  </span>
                ) : null}

                {/* Pencil / flash-check — edit button */}
                {editable && (
                  <button
                    onClick={openEdit}
                    className="ml-auto shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-primary/10 transition-colors"
                    title={`Edit ${team.short_name} owner`}
                  >
                    {flashOk
                      ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                      : <Pencil className="w-3 h-3 text-muted-foreground hover:text-primary" />
                    }
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Budget ────────────────────────────────── */}
        <div>
          <span className="font-display font-bold text-2xl leading-none" style={{ color:textColor }}>
            ₹{remaining.toFixed(2)} Cr
          </span>
          <span className="text-xs text-foreground/55 ml-1">purse left</span>
        </div>

        {/* ── Slots / Overseas ──────────────────────── */}
        <div className="flex gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md bg-primary/15 text-primary border border-primary/20">
            🏏 {slotsLeft} slots left
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md bg-accent/15 text-accent border border-accent/20">
            ✈️ {overseasLeft} overseas left
          </span>
        </div>

      </div>
    </motion.div>
  );
}
