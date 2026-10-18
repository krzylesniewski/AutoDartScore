import { useEffect, useState } from 'react';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { NewGameScreen } from './screens/NewGameScreen';
import { StatsScreen } from './screens/StatsScreen';

const HOME = '#/';

type Route = { screen: 'home' } | { screen: 'new-game' } | { screen: 'game'; matchId: string } | { screen: 'stats'; playerId: string | null } | null;

function parseRoute(hash: string): Route {
  if (hash === '' || hash === '#' || hash === HOME) {
    return { screen: 'home' };
  }
  if (hash === '#/new') {
    return { screen: 'new-game' };
  }
  const game = /^#\/matches\/([^/]+)$/.exec(hash);
  if (game?.[1]) {
    return { screen: 'game', matchId: decodeURIComponent(game[1]) };
  }
  if (hash === '#/stats') {
    return { screen: 'stats', playerId: null };
  }
  const stats = /^#\/stats\/([^/]+)$/.exec(hash);
  if (stats?.[1]) {
    return { screen: 'stats', playerId: decodeURIComponent(stats[1]) };
  }
  return null;
}

export function App() {
  const [hash, setHash] = useState(() => window.location.hash);
  const route = parseRoute(hash);
  const unknown = route === null;

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (unknown) {
      window.location.replace(HOME);
    }
  }, [unknown]);

  if (route?.screen === 'game') {
    return <GameScreen key={route.matchId} matchId={route.matchId} />;
  }
  if (route?.screen === 'stats') {
    return <StatsScreen playerId={route.playerId} />;
  }
  if (route?.screen === 'new-game') {
    return <NewGameScreen />;
  }
  return <HomeScreen />;
}
