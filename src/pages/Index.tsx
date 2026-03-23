import { useState, useMemo } from 'react';
import { useAuctionData } from '@/hooks/useAuctionData';
import { TeamCard } from '@/components/TeamCard';
import { CurrentPlayerSpotlight } from '@/components/CurrentPlayerSpotlight';
import { AuctionLogFeed } from '@/components/AuctionLogFeed';
import { AuctionSummary } from '@/components/AuctionSummary';
import { TopBuys } from '@/components/TopBuys';
import { LiveIndicator } from '@/components/LiveIndicator';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const Index = () => {
  const {
    teams, auctionPlayers, retainedPlayers, auctionLog,
    currentPlayer, isLive, loading,
    soldPlayersByTeam, retainedByTeam, refetch,
  } = useAuctionData();

  const [showSummary, setShowSummary] = useState(false);

  // Pre-build team map once — avoids re-building on every render
  const byShort = useMemo(() => {
    const m: Record<string, typeof teams[number]> = {};
    teams.forEach(t => { m[t.short_name] = t; });
    return m;
  }, [teams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="font-display text-2xl font-bold text-primary mb-2">Loading Auction...</div>
          <div className="text-sm text-muted-foreground">Connecting to live data</div>
        </div>
      </div>
    );
  }

  const leftKeys  = ['CSK', 'MI', 'RR'];
  const midKeys   = ['DC', 'GT', 'KKR', 'LSG'];
  const rightKeys = ['PBKS', 'RCB', 'SRH'];

  const renderCard = (key: string, col: number, row: number) => {
    const t = byShort[key];
    if (!t) return null;
    return (
      <div key={key} style={{ gridColumn: col, gridRow: row }} className="min-h-0">
        <TeamCard
          team={t}
          retained={retainedByTeam(t.id)}
          soldPlayers={soldPlayersByTeam(t.id)}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4 max-w-[1400px] mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">
            IPL 2026 — Live Auction Dashboard
          </h1>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            Real-time dashboard. <LiveIndicator isLive={isLive} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant={showSummary ? 'default' : 'outline'}
            size="sm" className="text-xs"
            onClick={() => setShowSummary(!showSummary)}
          >
            {showSummary ? '← Live View' : '📊 Auction Summary'}
          </Button>
          <Link to="/host">
            <Button variant="outline" size="sm" className="text-xs">Open Auction Room</Button>
          </Link>
          <Button variant="ghost" size="sm" className="text-xs" onClick={refetch}>
            Reload
          </Button>
        </div>
      </div>

      {showSummary ? (
        <AuctionSummary
          teams={teams}
          auctionPlayers={auctionPlayers}
          retainedPlayers={retainedPlayers}
        />
      ) : (
        <>
          {/* ── Live Auction Banner — shows ABOVE team grid when player is being auctioned ── */}
          {currentPlayer && (
            <div className="mb-4">
              <CurrentPlayerSpotlight player={currentPlayer} teams={teams} fullscreen={false} />
            </div>
          )}

          {/* ── Team Overview Grid — 3 | 4 | 3 ── */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-sm text-foreground">
                Team Overview
                {currentPlayer && (
                  <span className="ml-2 text-[10px] font-normal text-live animate-pulse">
                    🔴 LIVE — {currentPlayer.player_name} on auction
                  </span>
                )}
              </h2>
              <span className="text-[10px] text-muted-foreground">Click a team to view full squad</span>
            </div>

            <div
              className="gap-3"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gridTemplateRows: 'repeat(4, auto)',
              }}
            >
              {leftKeys.map((k, i)  => renderCard(k, 1, i + 2))}
              {midKeys.map((k, i)   => renderCard(k, 2, i + 1))}
              {rightKeys.map((k, i) => renderCard(k, 3, i + 2))}
            </div>
          </div>

          {/* ── Recent Sales + Top Buys ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AuctionLogFeed log={auctionLog} />
            <TopBuys players={auctionPlayers} teams={teams} />
          </div>
        </>
      )}
    </div>
  );
};

export default Index;
