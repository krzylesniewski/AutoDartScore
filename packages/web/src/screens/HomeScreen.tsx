import { CreateMatchRequest, CreateTournamentRequest, type MatchListItem, type Player } from '@autoscore/schema';
import { useCallback, useEffect, useState } from 'react';
import {
  ApiRequestError,
  abandonMatch,
  createMatch,
  createTournament,
  endPractice,
  listMatches,
  listPlayers,
  resumeMatch,
} from '../api/client';
import { apiErrorText } from '../api/error-text';
import { AbandonDialog } from '../components/AbandonDialog';
import { AppNav } from '../components/AppNav';
import { EndPracticeDialog } from '../components/EndPracticeDialog';
import { GameSetupSummary } from '../components/GameSetupSummary';
import { NewGameForm } from '../components/NewGameForm';
import { NewPlayerDialog } from '../components/NewPlayerDialog';
import type { PlayerList } from '../components/PlayerPicker';
import { StartBar } from '../components/StartBar';
import { TournamentForm } from '../components/TournamentForm';
import { TournamentPlan } from '../components/TournamentPlan';
import type { TournamentStartError, TournamentStartProps } from '../components/TournamentStart';
import { TournamentStartBar } from '../components/TournamentStartBar';
import { UnfinishedGames, type GameList } from '../components/UnfinishedGames';
import type { GameKind } from '../game/game-kind';
import { INITIAL_SETUP, changeType, createRequest, pickPlayer, type GameSetup } from '../game/game-setup';
import { createTournamentRequest, initialTournamentSetup, pickTournamentPlayer, type TournamentSetup } from '../game/tournament-setup';
import { useMediaQuery } from '../game/use-media-query';
import { pl } from '../i18n/pl';

// Próg lg z Tailwinda. Od niego przycisk turnieju stoi w panelu planu, a poniżej w pasku pod ekranem.
const LG_QUERY = '(min-width: 64rem)';

function matchHref(id: string): string {
  return `#/matches/${encodeURIComponent(id)}`;
}

function tournamentHref(id: string): string {
  return `#/tournaments/${encodeURIComponent(id)}`;
}

export interface HomeScreenProps {
  initialKind?: GameKind;
}

export function HomeScreen({ initialKind }: HomeScreenProps) {
  const [players, setPlayers] = useState<PlayerList>({ status: 'loading' });
  const [kind, setKind] = useState<GameKind>(initialKind ?? 'match');
  const [setup, setSetup] = useState<GameSetup>(INITIAL_SETUP);
  const [tournament, setTournament] = useState<TournamentSetup>(() => initialTournamentSetup(new Date()));
  const [startError, setStartError] = useState<string | null>(null);
  const [tournamentError, setTournamentError] = useState<TournamentStartError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [creatingPlayer, setCreatingPlayer] = useState(false);
  const wide = useMediaQuery(LG_QUERY);

  const [games, setGames] = useState<GameList>({ status: 'loading' });
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [abandoning, setAbandoning] = useState<MatchListItem | null>(null);
  const [ending, setEnding] = useState<MatchListItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPlayers().then(
      (loaded) => {
        if (!cancelled) {
          setPlayers({ status: 'ready', players: loaded });
        }
      },
      () => {
        if (!cancelled) {
          setPlayers({ status: 'error' });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const reloadGames = useCallback(async (): Promise<void> => {
    try {
      setGames({ status: 'ready', games: await listMatches({ status: 'unfinished' }) });
    } catch {
      setGames({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    listMatches({ status: 'unfinished' }).then(
      (loaded) => {
        if (!cancelled) {
          setGames({ status: 'ready', games: loaded });
        }
      },
      () => {
        if (!cancelled) {
          setGames({ status: 'error' });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const request = CreateMatchRequest.safeParse(createRequest(setup));
  const tournamentRequest = CreateTournamentRequest.safeParse(createTournamentRequest(tournament));
  const known = players.status === 'ready' ? players.players : [];
  const selected: Player[] = setup.playerIds.flatMap((id) => known.find((player) => player.id === id) ?? []);

  // Turniej ma osobny stan, więc jego wybór graczy zostaje przy przełączaniu kafli. Typy meczu dzielą jeden stan.
  function onKindChange(next: GameKind): void {
    setKind(next);
    if (next !== 'tournament') {
      setSetup((current) => changeType(current, next));
    }
  }

  function onPlayerCreated(player: Player): void {
    setCreatingPlayer(false);
    setPlayers((current) => ({ status: 'ready', players: [player, ...(current.status === 'ready' ? current.players : [])] }));
    if (kind === 'tournament') {
      setTournament((current) => pickTournamentPlayer(current, player.id));
    } else {
      setSetup((current) => pickPlayer(current, player.id));
    }
  }

  async function startTournament(): Promise<void> {
    if (!tournamentRequest.success) {
      return;
    }
    setSubmitting(true);
    setTournamentError(null);
    try {
      const view = await createTournament(tournamentRequest.data);
      window.location.hash = tournamentHref(view.id);
    } catch (caught) {
      setTournamentError({
        text: apiErrorText(caught),
        activeTournament: caught instanceof ApiRequestError && caught.code === 'tournament_active',
      });
      setSubmitting(false);
    }
  }

  const tournamentStart: TournamentStartProps = {
    canStart: tournamentRequest.success && !submitting,
    error: tournamentError,
    onStart: () => void startTournament(),
  };

  async function start(): Promise<void> {
    if (!request.success) {
      return;
    }
    setSubmitting(true);
    setStartError(null);
    try {
      const match = await createMatch(request.data);
      window.location.hash = matchHref(match.id);
    } catch (caught) {
      setStartError(apiErrorText(caught));
      setSubmitting(false);
    }
  }

  async function finish(game: MatchListItem): Promise<void> {
    if (game.status !== 'abandoned') {
      window.location.hash = matchHref(game.id);
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await resumeMatch(game.id);
      window.location.hash = matchHref(game.id);
    } catch {
      setNotice(pl.resumeFailed);
      setBusy(false);
    }
  }

  async function abandon(game: MatchListItem, playerId: string, reason: string | null): Promise<void> {
    setAbandoning(null);
    setBusy(true);
    setNotice(null);
    try {
      await abandonMatch(game.id, playerId, reason);
      await reloadGames();
    } catch {
      setNotice(pl.abandonFailed);
    } finally {
      setBusy(false);
    }
  }

  async function end(game: MatchListItem): Promise<void> {
    setEnding(null);
    setBusy(true);
    setNotice(null);
    try {
      await endPractice(game.id);
      await reloadGames();
    } catch {
      setNotice(pl.endPracticeFailed);
    } finally {
      setBusy(false);
    }
  }

  const closeAbandon = useCallback(() => setAbandoning(null), []);
  const closeEnd = useCallback(() => setEnding(null), []);
  const closeNewPlayer = useCallback(() => setCreatingPlayer(false), []);

  return (
    <div className="flex h-full flex-col">
      <AppNav current="new-game" />
      <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pt-4 pb-4 sm:gap-8 sm:px-8 lg:flex-row lg:gap-(--space-page) lg:overflow-hidden lg:px-(--space-page) xl:pt-5.5 xl:pb-4.5">
        {kind === 'tournament' ? (
          <TournamentForm
            setup={tournament}
            players={players}
            onKindChange={onKindChange}
            onChange={setTournament}
            onNewPlayer={() => setCreatingPlayer(true)}
          />
        ) : (
          <NewGameForm
            setup={setup}
            players={players}
            onKindChange={onKindChange}
            onPlayerToggle={(playerId) => setSetup((current) => pickPlayer(current, playerId))}
            onStartingScoreChange={(startingScore) => setSetup((current) => ({ ...current, startingScore }))}
            onBestOfChange={(bestOf) => setSetup((current) => ({ ...current, bestOf }))}
            onPracticeModeChange={(practiceMode) => setSetup((current) => ({ ...current, practiceMode }))}
            onCheckoutRangeChange={(checkoutRange) => setSetup((current) => ({ ...current, checkoutRange }))}
            onNewPlayer={() => setCreatingPlayer(true)}
          />
        )}
        <div className="flex shrink-0 flex-col gap-4 lg:min-h-0 lg:w-85 xl:w-110">
          {kind === 'tournament' ? (
            <TournamentPlan
              setup={tournament}
              config={tournamentRequest.success ? tournamentRequest.data : null}
              onSharingChange={(sharing) => setTournament((current) => ({ ...current, sharing }))}
              start={wide ? tournamentStart : null}
            />
          ) : (
            <GameSetupSummary setup={setup} players={selected} />
          )}
          <UnfinishedGames
            games={games}
            now={new Date()}
            busy={busy}
            notice={notice}
            onFinish={(game) => void finish(game)}
            onAbandon={setAbandoning}
            onEndPractice={setEnding}
          />
        </div>
      </main>
      {kind !== 'tournament' && (
        <StartBar
          setup={setup}
          players={selected}
          canStart={request.success && !submitting}
          error={startError}
          onStart={() => void start()}
        />
      )}
      {kind === 'tournament' && !wide && <TournamentStartBar {...tournamentStart} />}
      {creatingPlayer && <NewPlayerDialog onCreated={onPlayerCreated} onCancel={closeNewPlayer} />}
      {abandoning && (
        <AbandonDialog
          state={abandoning}
          onCancel={closeAbandon}
          onConfirm={(playerId, reason) => void abandon(abandoning, playerId, reason)}
        />
      )}
      {ending && <EndPracticeDialog onCancel={closeEnd} onConfirm={() => void end(ending)} />}
    </div>
  );
}
