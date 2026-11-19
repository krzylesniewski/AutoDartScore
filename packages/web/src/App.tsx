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
const TournamentsScreen = lazy(() => import('./screens/TournamentsScreen').then((module) => ({ default: module.TournamentsScreen })));
const TournamentScreen = lazy(() => import('./screens/TournamentScreen').then((module) => ({ default: module.TournamentScreen })));
const TournamentMatchScreen = lazy(() =>
  import('./screens/TournamentMatchScreen').then((module) => ({ default: module.TournamentMatchScreen })),
);
const TournamentTvScreen = lazy(() => import('./screens/TournamentTvScreen').then((module) => ({ default: module.TournamentTvScreen })));
const PublicTournamentScreen = lazy(() =>
  import('./screens/PublicTournamentScreen').then((module) => ({ default: module.PublicTournamentScreen })),
);
const PublicMatchScreen = lazy(() => import('./screens/PublicMatchScreen').then((module) => ({ default: module.PublicMatchScreen })));

const HOME = '#/';

type Route =
  | { screen: 'home' }
  | { screen: 'new-tournament' }
  | { screen: 'game'; matchId: string }
  | { screen: 'stats'; playerId: string | null }
  | { screen: 'history' }
  | { screen: 'settings' }
  | { screen: 'tournaments' }
  | { screen: 'tournament'; tournamentId: string }
  | { screen: 'tournament-match'; tournamentId: string; matchId: string }
  | { screen: 'tournament-tv'; tournamentId: string }
  | { screen: 'public-tournament'; tournamentId: string }
  | { screen: 'public-match'; tournamentId: string; matchId: string }
  | null;

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
  if (hash === '#/tournaments') {
    return { screen: 'tournaments' };
  }
  // Przed trasą z identyfikatorem, bo „new” pasuje też do niej.
  if (hash === '#/tournaments/new') {
    return { screen: 'new-tournament' };
  }
  const tournament = /^#\/tournaments\/([^/]+)$/.exec(hash);
  if (tournament?.[1]) {
    return { screen: 'tournament', tournamentId: decodeURIComponent(tournament[1]) };
  }
  const tournamentMatch = /^#\/tournaments\/([^/]+)\/matches\/([^/]+)$/.exec(hash);
  if (tournamentMatch?.[1] && tournamentMatch[2]) {
    return {
      screen: 'tournament-match',
      tournamentId: decodeURIComponent(tournamentMatch[1]),
      matchId: decodeURIComponent(tournamentMatch[2]),
    };
  }
  const tournamentTv = /^#\/tournaments\/([^/]+)\/tv$/.exec(hash);
  if (tournamentTv?.[1]) {
    return { screen: 'tournament-tv', tournamentId: decodeURIComponent(tournamentTv[1]) };
  }
  const publicTournament = /^#\/t\/([^/]+)$/.exec(hash);
  if (publicTournament?.[1]) {
    return { screen: 'public-tournament', tournamentId: decodeURIComponent(publicTournament[1]) };
  }
  const publicMatch = /^#\/t\/([^/]+)\/matches\/([^/]+)$/.exec(hash);
  if (publicMatch?.[1] && publicMatch[2]) {
    return {
      screen: 'public-match',
      tournamentId: decodeURIComponent(publicMatch[1]),
      matchId: decodeURIComponent(publicMatch[2]),
    };
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

  // Publiczny link działa bez logowania, więc 401 z innego miejsca nie może go zasłonić ekranem logowania.
  if (route?.screen === 'public-tournament') {
    return (
      <Stage light="list">
        <LazyScreen key={route.screen}>
          <PublicTournamentScreen key={route.tournamentId} tournamentId={route.tournamentId} />
        </LazyScreen>
      </Stage>
    );
  }
  if (route?.screen === 'public-match') {
    return (
      <Stage light="list">
        <LazyScreen key={route.screen}>
          <PublicMatchScreen key={`${route.tournamentId}/${route.matchId}`} tournamentId={route.tournamentId} matchId={route.matchId} />
        </LazyScreen>
      </Stage>
    );
  }

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
  // Klucz z nazwą ekranu, bo drzewo Stage z LazyScreen ma ten sam kształt na kilku trasach i bez niego błąd wczytania jednego ekranu zostałby na następnym.
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
  if (route?.screen === 'tournaments') {
    return (
      <Stage light="list">
        <LazyScreen key={route.screen}>
          <TournamentsScreen />
        </LazyScreen>
      </Stage>
    );
  }
  if (route?.screen === 'tournament') {
    return (
      <Stage light="list">
        <LazyScreen key={route.screen}>
          <TournamentScreen key={route.tournamentId} tournamentId={route.tournamentId} />
        </LazyScreen>
      </Stage>
    );
  }
  if (route?.screen === 'tournament-match') {
    return (
      <Stage light="list">
        <LazyScreen key={route.screen}>
          <TournamentMatchScreen key={`${route.tournamentId}/${route.matchId}`} tournamentId={route.tournamentId} matchId={route.matchId} />
        </LazyScreen>
      </Stage>
    );
  }
  if (route?.screen === 'tournament-tv') {
    return (
      <Stage light="game">
        <LazyScreen key={route.screen}>
          <TournamentTvScreen key={route.tournamentId} tournamentId={route.tournamentId} />
        </LazyScreen>
      </Stage>
    );
  }
  // Osobne klucze, żeby przejście między #/ a #/tournaments/new tworzyło kreator od nowa z właściwym typem.
  return (
    <Stage light="game">
      {route?.screen === 'new-tournament' ? <HomeScreen key="new-tournament" initialKind="tournament" /> : <HomeScreen key="home" />}
    </Stage>
  );
}
