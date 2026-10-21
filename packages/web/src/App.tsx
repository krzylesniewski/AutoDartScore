import { useEffect, useState } from 'react';
import { onUnauthorized } from './api/session';
import { GameScreen } from './screens/GameScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StatsScreen } from './screens/StatsScreen';

const HOME = '#/';

type Route = { screen: 'home' } | { screen: 'game'; matchId: string } | { screen: 'stats'; playerId: string | null } | { screen: 'history' } | { screen: 'settings' } | null;

function parseRoute(hash: string): Route {
  if (hash === '' || hash === '#' || hash === HOME) {
    return { screen: 'home' };
  }
  const game = /^#\/matches\/([^/]+)$/.exec(hash);
  if (game?.[1]) {
    return { screen: 'game', matchId: decodeURIComponent(game[1]) };
  }
  if (hash === '#/history') {
    return { screen: 'history' };
  }
  if (hash === '#/settings') {
    return { screen: 'settings' };
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
  const [loginRequired, setLoginRequired] = useState(false);

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

  useEffect(() => onUnauthorized(() => setLoginRequired(true)), []);

  // Po zalogowaniu ekran z adresu montuje się od nowa i pobiera dane już z tokenem.
  if (loginRequired) {
    return <LoginScreen onLoggedIn={() => setLoginRequired(false)} />;
  }

  if (route?.screen === 'game') {
    return <GameScreen key={route.matchId} matchId={route.matchId} />;
  }
  if (route?.screen === 'history') {
    return <HistoryScreen />;
  }
  if (route?.screen === 'settings') {
    return <SettingsScreen />;
  }
  if (route?.screen === 'stats') {
    return <StatsScreen playerId={route.playerId} />;
  }
  return <HomeScreen />;
}
