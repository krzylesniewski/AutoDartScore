import type { MatchSnapshot } from '@autoscore/schema';
import { useMatch } from '../api/use-match';
import { useAnnouncer } from '../audio/use-announcer';
import { EventBanner } from '../components/EventBanner';
import { Keypad } from '../components/Keypad';
import { Scoreboard } from '../components/Scoreboard';
import { TurnPanel } from '../components/TurnPanel';
import { VoiceToggle } from '../components/VoiceToggle';
import { TrophyIcon, WarningIcon } from '../components/icons';
import { pl } from '../i18n/pl';

const NEW_GAME_HREF = '#/';

export function GameScreen({ matchId }: { matchId: string }) {
  const voice = useAnnouncer();
  const { state, lastTurn, banner, error, busy, connection, notFound, sendHit, sendUndo } = useMatch(matchId, voice.onLiveMessage);

  if (notFound) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-4 p-6 font-display">
        <p className="flex items-center gap-2 text-3xl">
          <WarningIcon className="text-warning" />
          {pl.matchNotFound}
        </p>
        <a href={NEW_GAME_HREF} className="text-xl uppercase text-board-green underline">
          {pl.newGame}
        </a>
      </main>
    );
  }

  const keypadDisabled = !state || state.finished || connection !== 'open';

  return (
    <main className="grid h-full grid-cols-1 gap-6 p-4 landscape:grid-cols-2">
      <div className="flex flex-col gap-4">
        {connection === 'closed' && <Notice text={pl.connectionLost} />}
        {state ? <Scoreboard state={state} size="large" /> : <p className="font-display text-muted">{pl.loading}</p>}
        {state?.finished && <MatchOver state={state} />}
      </div>
      <div className="flex flex-col gap-4">
        <VoiceToggle enabled={voice.enabled} onChange={voice.setEnabled} />
        {state && <TurnPanel state={state} lastTurn={lastTurn} busy={busy} onUndo={sendUndo} />}
        <EventBanner banner={banner} />
        {error && <Notice text={error} />}
        <Keypad onHit={sendHit} disabled={keypadDisabled} />
      </div>
    </main>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 rounded-card border border-warning px-4 py-2 font-display text-xl text-warning">
      <WarningIcon />
      {text}
    </p>
  );
}

function MatchOver({ state }: { state: MatchSnapshot }) {
  const name = (playerId: string | null) => state.players.find((player) => player.id === playerId)?.name ?? '';
  return (
    <section className="flex flex-col gap-2 rounded-card border-l-4 border-board-green bg-surface p-4 font-display">
      <h2 className="flex items-center gap-2 text-3xl font-bold uppercase">
        <TrophyIcon className="text-warning" />
        {pl.matchOver}
      </h2>
      <MatchResult state={state} name={name} />
      <a href={NEW_GAME_HREF} className="text-xl uppercase text-board-green underline">
        {pl.newGame}
      </a>
    </section>
  );
}

function MatchResult({ state, name }: { state: MatchSnapshot; name: (playerId: string | null) => string }) {
  if (state.type === 'casual') {
    return (
      <ol className="text-2xl">
        {[...state.placements]
          .sort((a, b) => a.place - b.place)
          .map((placement) => (
            <li key={placement.playerId}>
              {pl.place(placement.place)} {name(placement.playerId)}
            </li>
          ))}
      </ol>
    );
  }
  if (state.type === 'match') {
    const winner = state.players.find((player) => player.id === state.winnerId);
    const loser = state.players.find((player) => player.id !== state.winnerId);
    return (
      <p className="text-2xl">
        {name(state.winnerId)} {pl.legsScore(winner?.legsWon ?? 0, loser?.legsWon ?? 0)}
      </p>
    );
  }
  return <p className="text-2xl">{state.players[0]?.name}</p>;
}
