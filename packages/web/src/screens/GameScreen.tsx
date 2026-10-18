import type { MatchSnapshot } from '@autoscore/schema';
import { useMatch } from '../api/use-match';
import { useAnnouncer } from '../audio/use-announcer';
import { EventBanner } from '../components/EventBanner';
import { Keypad } from '../components/Keypad';
import { MatchHeader } from '../components/MatchHeader';
import { Scoreboard } from '../components/Scoreboard';
import { TurnPanel } from '../components/TurnPanel';
import { TrophyIcon, WarningIcon } from '../components/icons';
import { pl } from '../i18n/pl';

const NEW_GAME_HREF = '#/';

const link = 'text-xl font-semibold uppercase text-(--color-text) underline';

export function GameScreen({ matchId }: { matchId: string }) {
  const audio = useAnnouncer();
  const { state, lastTurn, banner, error, busy, connection, notFound, sendHit, sendUndo } = useMatch(matchId, audio.onLiveMessage);

  if (notFound) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-4 p-(--space-page) font-display">
        <p className="flex items-center gap-2 text-3xl">
          <WarningIcon className="text-(--color-accent)" />
          {pl.matchNotFound}
        </p>
        <a href={NEW_GAME_HREF} className={link}>
          {pl.newGame}
        </a>
      </main>
    );
  }

  const keypadDisabled = !state || state.finished || connection !== 'open';

  return (
    <div className="flex h-full flex-col">
      <MatchHeader
        state={state}
        voiceEnabled={audio.voiceEnabled}
        onVoiceChange={audio.setVoiceEnabled}
        effectsEnabled={audio.effectsEnabled}
        onEffectsChange={audio.setEffectsEnabled}
      />
      <main className="grid min-h-0 flex-1 grid-cols-1 content-start gap-(--space-page) overflow-auto p-(--space-page) landscape:grid-cols-[var(--scoreboard-width)_1fr]">
        <div className="flex flex-col gap-4">
          {state ? <Scoreboard state={state} size="large" /> : <p className="font-display text-(--color-text-muted)">{pl.loading}</p>}
          {state?.finished && <MatchOver state={state} />}
        </div>
        <div className="relative flex flex-col gap-3">
          {connection === 'closed' && <Notice text={pl.connectionLost} />}
          {error && <Notice text={error} />}
          {state && <TurnPanel state={state} lastTurn={lastTurn} busy={busy} onUndo={sendUndo} />}
          <Keypad onHit={sendHit} disabled={keypadDisabled} />
          <EventBanner banner={banner} />
        </div>
      </main>
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 rounded-(--radius-card) border-(length:--border-width) border-(--color-accent) bg-(--color-surface) px-4 py-2 font-display text-xl text-(--color-text)">
      <WarningIcon className="text-(--color-accent)" />
      {text}
    </p>
  );
}

function MatchOver({ state }: { state: MatchSnapshot }) {
  const name = (playerId: string | null) => state.players.find((player) => player.id === playerId)?.name ?? '';
  return (
    <section className="flex flex-col gap-2 rounded-(--radius-card) border-(length:--border-width) border-(--color-border-strong) bg-(--color-surface) p-4 font-display">
      <h2 className="flex items-center gap-2 text-3xl font-bold uppercase">
        <TrophyIcon className="text-(--color-text)" />
        {pl.matchOver}
      </h2>
      <MatchResult state={state} name={name} />
      <a href={NEW_GAME_HREF} className={link}>
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
