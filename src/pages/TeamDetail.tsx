import { useParams, Link } from 'react-router-dom';
import { useAuctionData } from '@/hooks/useAuctionData';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useMemo } from 'react';

const ROLE_CATEGORIES = [
  { label: 'Batsmen', keys: ['BATTER', 'BATSMAN', 'BATSMEN', 'BAT'] },
  { label: 'WK', keys: ['WICKETKEEPER', 'WK', 'WICKET-KEEPER', 'WK-BATTER'] },
  { label: 'Allrounder', keys: ['ALL-ROUNDER', 'ALLROUNDER', 'ALL ROUNDER', 'AR'] },
  { label: 'Fast Bowler', keys: ['FAST BOWLER', 'PACER', 'PACE', 'SEAMER', 'FAST'] },
  { label: 'Spin Bowler', keys: ['SPINNER', 'SPIN', 'SPIN BOWLER'] },
];

function categorizeRole(role: string | null): string {
  if (!role) return 'Batsmen';
  const upper = role.toUpperCase().trim();
  for (const cat of ROLE_CATEGORIES) {
    if (cat.keys.some(k => upper.includes(k) || upper === k)) return cat.label;
  }
  if (upper.includes('BOWL')) return 'Fast Bowler';
  return 'Batsmen';
}

export default function TeamDetail() {
  const { teamId } = useParams<{ teamId: string }>();
  const { teams, retainedPlayers, soldPlayersByTeam, retainedByTeam, loading } = useAuctionData();

  const team = teams.find(t => t.id === teamId);
  const retained = teamId ? retainedByTeam(teamId) : [];
  const soldPlayers = teamId ? soldPlayersByTeam(teamId) : [];

  const remaining = team ? team.total_budget - team.spent_budget : 0;
  const totalPlayers = soldPlayers.length + retained.length;
  const overseasCount = soldPlayers.filter(p => p.country !== 'India').length + retained.filter(r => r.nationality !== 'India' && r.nationality != null).length;

  const roleGroups = useMemo(() => {
    const all = [
      ...retained.map(p => ({
        name: p.player_name,
        price: p.retention_price,
        overseas: p.nationality !== 'India' && p.nationality != null,
        role: categorizeRole(p.role),
        isRetained: true,
      })),
      ...soldPlayers.map(p => ({
        name: p.player_name,
        price: p.sold_price,
        overseas: p.country !== 'India' && p.country != null,
        role: categorizeRole(p.role),
        isRetained: false,
      })),
    ];
    return ROLE_CATEGORIES.map(cat => ({
      label: cat.label,
      players: all.filter(p => p.role === cat.label).sort((a, b) => (b.price ?? 0) - (a.price ?? 0)),
    })).filter(g => g.players.length > 0);
  }, [retained, soldPlayers]);

  const topBuys = useMemo(() =>
    [...soldPlayers]
      .filter(p => p.sold_price != null)
      .sort((a, b) => (b.sold_price ?? 0) - (a.sold_price ?? 0))
      .slice(0, 5),
    [soldPlayers]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-display text-xl text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="font-display text-xl text-muted-foreground mb-4">Team not found</div>
          <Link to="/"><Button variant="outline">Back to Dashboard</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 max-w-[1200px] mx-auto">
      <Link to="/">
        <Button variant="ghost" size="sm" className="mb-4 gap-1.5 text-xs">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Button>
      </Link>

      {/* Team Header */}
      <div
        className="rounded-xl p-6 mb-6 border border-border/50"
        style={{
          background: `linear-gradient(135deg, ${team.color}30 0%, hsl(var(--card)) 100%)`,
          borderLeft: `4px solid ${team.color}`,
        }}
      >
        <div className="flex items-center gap-4 mb-4">
          {team.logo_url && (
            <img src={team.logo_url} alt={team.short_name} className="w-16 h-16 object-contain" />
          )}
          <div>
            <h1 className="font-display font-bold text-3xl text-foreground">{team.name}</h1>
            <span
              className="font-display font-bold text-sm px-3 py-1 rounded mt-1 inline-block"
              style={{ backgroundColor: team.color, color: '#fff' }}
            >
              {team.short_name}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-background/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground">Purse Left</div>
            <div className="font-display font-bold text-2xl" style={{ color: team.color }}>
              ₹{remaining.toFixed(2)} Cr
            </div>
          </div>
          <div className="bg-background/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground">Spent</div>
            <div className="font-display font-bold text-2xl text-foreground">
              ₹{team.spent_budget.toFixed(2)} Cr
            </div>
          </div>
          <div className="bg-background/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground">Players</div>
            <div className="font-display font-bold text-2xl text-foreground">
              {totalPlayers}/{team.player_slots}
            </div>
          </div>
          <div className="bg-background/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground">Overseas</div>
            <div className="font-display font-bold text-2xl text-foreground">
              {overseasCount}/{team.overseas_slots}
            </div>
          </div>
        </div>
      </div>

      {/* Top Buys */}
      {topBuys.length > 0 && (
        <div className="mb-6">
          <h2 className="font-display font-bold text-lg text-foreground mb-3">Top Buys</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {topBuys.map(p => (
              <div
                key={p.id}
                className="rounded-lg border border-border/50 p-3 text-center"
                style={{ background: `${team.color}10` }}
              >
                <div className="font-bold text-sm text-foreground">{p.player_name}</div>
                <div className="text-xs text-muted-foreground">{p.role}</div>
                <div className="font-display font-bold text-lg mt-1" style={{ color: team.color }}>
                  ₹{p.sold_price?.toFixed(2)} Cr
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Role-wise Squad */}
      <h2 className="font-display font-bold text-lg text-foreground mb-3">Squad Breakdown</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roleGroups.map(group => (
          <div
            key={group.label}
            className="rounded-lg border border-border/50 p-4"
            style={{ background: `${team.color}08` }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold uppercase tracking-wider" style={{ color: team.color }}>
                {group.label}
              </span>
              <span
                className="text-xs font-bold rounded px-2 py-0.5"
                style={{ backgroundColor: `${team.color}30`, color: team.color }}
              >
                {group.players.length}
              </span>
            </div>
            <div className="space-y-2">
              {group.players.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-foreground">
                    {p.overseas && <span className="text-xs">✈️</span>}
                    {p.name}
                    {p.isRetained && (
                      <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">RTM</span>
                    )}
                  </span>
                  {p.price != null && (
                    <span className="font-bold whitespace-nowrap" style={{ color: team.color }}>
                      ₹{p.price} Cr
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {roleGroups.length === 0 && (
        <div className="text-center text-muted-foreground py-12 text-sm">
          No players in this squad yet. Players will appear here once bought or retained.
        </div>
      )}
    </div>
  );
}
