import { CreateMatchRequest, type MatchListItem, type Player } from '@autoscore/schema';
import { useCallback, useEffect, useState } from 'react';
import { ApiRequestError, abandonMatch, createMatch, endPractice, listMatches, listPlayers, resumeMatch } from '../api/client';
import { AbandonDialog } from '../components/AbandonDialog';
import { AppNav } from '../components/AppNav';
import { EndPracticeDialog } from '../components/EndPracticeDialog';
import { GameSetupSummary } from '../components/GameSetupSummary';
import { NewGameForm, type PlayerList } from '../components/NewGameForm';
import { NewPlayerDialog } from '../components/NewPlayerDialog';
import { UnfinishedGames, type GameList } from '../components/UnfinishedGames';
import { INITIAL_SETUP, changeType, createRequest, pickPlayer, type GameSetup } from '../game/game-setup';
import { pl } from '../i18n/pl';

function matchHref(id: string): string {
  return `#/matches/${encodeURIComponent(id)}`;
}

export function HomeScreen() {
  const [players, setPlayers] = useState<PlayerList>({ status: 'loading' });
  const [setup, setSetup] = useState<GameSetup>(INITIAL_SETUP);
  const [startError, setStartError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [creatingPlayer, setCreatingPlayer] = useState(false);

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
  const known = players.status === 'ready' ? players.players : [];
  const selected = setup.playerIds.flatMap((id) => {
    const colorIndex = known.findIndex((player) => player.id === id);
    const player = known[colorIndex];
    return player ? [{ player, colorIndex }] : [];
  });

  function onPlayerCreated(player: Player): void {
    setCreatingPlayer(false);
    setPlayers((current) => ({ status: 'ready', players: [player, ...(current.status === 'ready' ? current.players : [])] }));
    setSetup((current) => pickPlayer(current, player.id));
  }

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
      setStartError(caught instanceof ApiRequestError ? caught.message : pl.requestFailed);
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
      const trimmed = reason?.trim();
      await abandonMatch(game.id, { playerId, ...(trimmed ? { reason: trimmed } : {}) });
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
      <main className="flex min-h-0 flex-1 flex-col gap-12 overflow-auto px-12 py-8 lg:flex-row lg:overflow-hidden">
        <NewGameForm
          setup={setup}
          players={players}
          canStart={request.success && !submitting}
          error={startError}
          onTypeChange={(type) => setSetup((current) => changeType(current, type))}
          onPlayerToggle={(playerId) => setSetup((current) => pickPlayer(current, playerId))}
          onStartingScoreChange={(startingScore) => setSetup((current) => ({ ...current, startingScore }))}
          onBestOfChange={(bestOf) => setSetup((current) => ({ ...current, bestOf }))}
          onPracticeModeChange={(practiceMode) => setSetup((current) => ({ ...current, practiceMode }))}
          onNewPlayer={() => setCreatingPlayer(true)}
          onStart={() => void start()}
        />
        <div className="flex min-h-0 flex-col gap-5 lg:w-110 lg:shrink-0">
          <GameSetupSummary setup={setup} players={selected} />
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
      {creatingPlayer && <NewPlayerDialog onCreated={onPlayerCreated} onCancel={closeNewPlayer} />}
      {abandoning && <AbandonDialog state={abandoning} onCancel={closeAbandon} onConfirm={(playerId, reason) => void abandon(abandoning, playerId, reason)} />}
      {ending && <EndPracticeDialog onCancel={closeEnd} onConfirm={() => void end(ending)} />}
    </div>
  );
}
