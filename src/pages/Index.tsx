import { useAuctionData } from '@/hooks/useAuctionData';
import { TeamCard } from '@/components/TeamCard';
import { CurrentPlayerSpotlight } from '@/components/CurrentPlayerSpotlight';
import { AuctionLogFeed } from '@/components/AuctionLogFeed';
import { LiveIndicator } from '@/components/LiveIndicator';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const Index = () => {
  const {
    teams,
    auctionLog,
    currentPlayer,
    isLive,
    loading,
    soldPlayersByTeam,
    retainedByTeam,
    refetch,
  } = useAuctionData();

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

      {/* Current Player Spotlight — Large & Dominant */}
      {currentPlayer && (
        <div className="mb-4">
          <CurrentPlayerSpotlight player={currentPlayer} teams={teams} />
        </div>
      )}

      {/* Team Overview Grid */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display font-bold text-sm text-foreground">Team Overview</h2>
          <span className="text-[10px] text-muted-foreground">Purse, player slots & overseas slots</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {teams.map(team => (
            <TeamCard
              key={team.id}
              team={team}
              retained={retainedByTeam(team.id)}
              soldPlayers={soldPlayersByTeam(team.id)}
            />
          ))}
        </div>
      </div>

      {/* Auction Log */}
      <div className="max-w-lg">
        <AuctionLogFeed log={auctionLog} />
      </div>
    </div>
  );
};

export default Index;
