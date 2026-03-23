import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { User, Pencil, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Team          = Database['public']['Tables']['teams']['Row'];
type AuctionPlayer = Database['public']['Tables']['auction_players']['Row'];
type RetainedPlayer= Database['public']['Tables']['retained_players']['Row'];

function ensureReadableColor(hex: string): string {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  const lum = (0.299*r + 0.587*g + 0.114*b)/255;
  if (lum < 0.35) {
    const f=1.6;
    return `#${Math.min(255,Math.round(r*f+40)).toString(16).padStart(2,'0')}${Math.min(255,Math.round(g*f+40)).toString(16).padStart(2,'0')}${Math.min(255,Math.round(b*f+40)).toString(16).padStart(2,'0')}`;
  }
  return hex;
}

interface TeamCardProps {
  team: Team;
  retained: RetainedPlayer[];
  soldPlayers: AuctionPlayer[];
  editable?: boolean; // show inline edit UI (dashboard only)
}

export function TeamCard({ team, retained, soldPlayers, editable = false }: TeamCardProps) {
  const navigate   = useNavigate();
  const remaining  = team.total_budget - team.spent_budget;
  const totalPlayers = soldPlayers.length;
  const overseasCount = soldPlayers.filter(p => p.country !== 'India').length;
  const overseasLeft  = team.overseas_slots - overseasCount;
  const slotsLeft     = team.player_slots - totalPlayers;

  const ownerName = (team as any).owner_name as string | null;
  const owners    = ownerName ? ownerName.split(',').map(s => s.trim()).filter(Boolean) : [];

  const isDark    = document.documentElement.classList.contains('dark') || !document.documentElement.classList.contains('light');
  const textColor = isDark ? ensureReadableColor(team.color) : team.color;

  // ── Inline edit state ─────────────────────────────────────
  const [editing,   setEditing]   = useState(false);
  const [editValue, setEditValue] = useState(ownerName ?? '');
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveTimer= useRef<ReturnType<typeof setTimeout>>();

  const openEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(ownerName ?? '');
    setEditing(true);
    setSaved(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditing(false);
    setEditValue(ownerName ?? '');
  };

  const saveOwner = useCallback(async (value: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSaving(true);
    const cleaned = value.trim() || null;
    const { error } = await supabase
      .from('teams')
      .update({ owner_name: cleaned } as any)
      .eq('id', team.id);

    setSaving(false);
    if (!error) {
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2000);
    }
  }, [team.id]);

  // Auto-save after 800ms of no typing
  const handleChange = (val: string) => {
    setEditValue(val);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveOwner(val), 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') { clearTimeout(saveTimer.current); saveOwner(editValue); }
    if (e.key === 'Escape') cancelEdit();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg overflow-hidden border border-border/50 hover:border-border transition-colors h-full select-none"
      style={{
        background: `linear-gradient(135deg, ${team.color}22 0%, hsl(var(--card)) 100%)`,
        borderLeft: `3px solid ${team.color}`,
        cursor: editable ? 'default' : 'pointer',
      }}
      onClick={() => !editable && navigate(`/team/${team.id}`)}
    >
      <div className="p-3">
        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {team.logo_url && (
              <img src={team.logo_url} alt={team.short_name} className="w-8 h-8 object-contain" />
            )}
            <div>
              <span
                className="font-display font-bold text-sm px-2 py-0.5 rounded"
                style={{ backgroundColor: team.color, color: '#fff' }}
              >
                {team.short_name}
              </span>
              <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">{team.name}</span>
            </div>
          </div>
          <span className="font-display font-bold text-sm text-foreground">{totalPlayers}/{team.player_slots}</span>
        </div>

        {/* ── Owner name — editable inline ────────────────── */}
        <div className="mb-2 min-h-[26px]">
          {editable && editing ? (
            /* Edit mode */
            <div
              className="flex items-center gap-1"
              onClick={e => e.stopPropagation()}
            >
              <input
                ref={inputRef}
                value={editValue}
                onChange={e => handleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => { clearTimeout(saveTimer.current); saveOwner(editValue); }}
                placeholder="Owner name(s), comma-separated"
                className="flex-1 h-6 text-xs px-2 rounded border border-primary bg-background text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={e => { clearTimeout(saveTimer.current); saveOwner(editValue, e); }}
                className="w-5 h-5 flex items-center justify-center rounded text-emerald-500 hover:bg-emerald-500/10"
                title="Save"
              >
                {saving ? (
                  <span className="w-3 h-3 border border-emerald-500 border-t-transparent rounded-full animate-spin inline-block" />
                ) : <Check className="w-3 h-3" />}
              </button>
              <button
                onClick={cancelEdit}
                className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:bg-muted"
                title="Cancel"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            /* Display mode */
            <div className="flex items-center gap-1 flex-wrap">
              {owners.length > 0 ? (
                owners.map((name, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${team.color}25`, color: textColor, border: `1px solid ${team.color}50` }}
                  >
                    <User className="w-2.5 h-2.5 shrink-0" />
                    {name}
                  </span>
                ))
              ) : editable ? (
                <span className="text-[11px] text-muted-foreground/50 italic">No owner — click ✏️ to add</span>
              ) : null}

              {/* Edit pencil — only in editable (dashboard) mode */}
              {editable && (
                <button
                  onClick={openEdit}
                  className="ml-auto w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  title={`Edit ${team.short_name} owner`}
                >
                  {saved ? <Check className="w-3 h-3 text-emerald-500" /> : <Pencil className="w-3 h-3" />}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Budget ─────────────────────────────────────── */}
        <div className="mb-3">
          <span className="font-display font-bold text-2xl" style={{ color: textColor }}>
            ₹{remaining.toFixed(2)} Cr
          </span>
          <span className="text-xs text-foreground/60 ml-1">purse left</span>
        </div>

        {/* ── Stats ──────────────────────────────────────── */}
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
