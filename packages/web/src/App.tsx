import { lazy, useEffect, useState } from 'react';
import { onUnauthorized } from './api/session';
import { LazyScreen } from './components/LazyScreen';
import { Stage } from './components/Stage';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';

// Ekrany spoza gry wczytują się dopiero po wejściu na nie, żeby pierwsze ładowanie było mniejsze.
const StatsScreen = lazy(() => import('./screens/StatsScreen').then((module) => ({ default: module.StatsScreen })));
const HistoryScreen = lazy(() => import('./screens/HistoryScreen').then((module) => ({ default: module.HistoryScreen })));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen').then((module) => ({ default: module.SettingsScreen })));

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
    return (
      <Stage light="center">
        <LoginScreen onLoggedIn={() => setLoginRequired(false)} />
      </Stage>
    );
  }

  if (route?.screen === 'game') {
    return (
      <Stage light="game">
        <GameScreen key={route.matchId} matchId={route.matchId} />
      </Stage>
    );
  }
  // Klucz z nazwą ekranu, bo drzewo Stage z LazyScreen ma ten sam kształt na trzech trasach i bez niego błąd wczytania jednego ekranu zostałby na następnym.
  if (route?.screen === 'history') {
    return (
      <Stage light="list">
        <LazyScreen key={route.screen}>
          <HistoryScreen />
        </LazyScreen>
      </Stage>
    );
  }
  if (route?.screen === 'settings') {
    return (
      <Stage light="game">
        <LazyScreen key={route.screen}>
          <SettingsScreen />
        </LazyScreen>
      </Stage>
    );
  }
  if (route?.screen === 'stats') {
    return (
      <Stage light="list">
        <LazyScreen key={route.screen}>
          <StatsScreen playerId={route.playerId} />
        </LazyScreen>
      </Stage>
    );
  }
  return (
    <Stage light="game">
      <HomeScreen />
    </Stage>
  );
}
