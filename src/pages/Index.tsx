import { useState } from 'react';
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
    teams,
    auctionPlayers,
    retainedPlayers,
    auctionLog,
    currentPlayer,
    isLive,
    loading,
    soldPlayersByTeam,
    retainedByTeam,
    refetch,
  } = useAuctionData();

  const [showSummary, setShowSummary] = useState(false);

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

  // Fullscreen mode when a player is being auctioned
  if (currentPlayer) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-[1400px]">
          <CurrentPlayerSpotlight player={currentPlayer} teams={teams} fullscreen />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 max-w-[1400px] mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">
            IPL 2026 — Live Auction Dashboard
          </h1>
          <p className="text-xs text-muted-foreground">
            Real-time dashboard for live auction. <LiveIndicator isLive={isLive} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant={showSummary ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={() => setShowSummary(!showSummary)}
          >
            {showSummary ? '← Live View' : '📊 Auction Summary'}
          </Button>
          <Link to="/host">
            <Button variant="outline" size="sm" className="text-xs">
              Open Auction Room
            </Button>
          </Link>
          <Button variant="ghost" size="sm" className="text-xs" onClick={refetch}>
            Reload now
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
          {/* Team Overview Grid */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display font-bold text-sm text-foreground">Team Overview</h2>
              <span className="text-[10px] text-muted-foreground">Purse, player slots & overseas slots</span>
            </div>
            {(() => {
              const teamsByShort: Record<string, typeof teams[number]> = {};
              teams.forEach(t => { teamsByShort[t.short_name] = t; });
              const leftKeys = ['CSK', 'MI', 'RR'];
              const midKeys = ['DC', 'GT', 'KKR', 'LSG'];
              const rightKeys = ['PBKS', 'RCB', 'SRH'];
              const renderCard = (t: typeof teams[number] | undefined) =>
                t ? <TeamCard key={t.id} team={t} retained={retainedByTeam(t.id)} soldPlayers={soldPlayersByTeam(t.id)} /> : null;

              return (
                <div className="grid grid-cols-3 gap-4 items-start">
                  {/* Left column — 3 cards */}
                  <div className="flex flex-col gap-4">
                    {leftKeys.map(k => renderCard(teamsByShort[k]))}
                  </div>
                  {/* Middle column — 4 cards */}
                  <div className="flex flex-col gap-4">
                    {midKeys.map(k => renderCard(teamsByShort[k]))}
                  </div>
                  {/* Right column — 3 cards, offset down to align with 2nd middle card */}
                  <div className="flex flex-col gap-4" style={{ marginTop: 'calc((100% - 3 * 0px) / 4 + 1rem)' }}>
                    {rightKeys.map(k => renderCard(teamsByShort[k]))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Auction Log + Top 10 Buys */}
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
