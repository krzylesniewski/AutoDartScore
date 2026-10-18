import { useMatch } from '../api/use-match';
import { useMatchSummary } from '../api/use-match-summary';
import { useAnnouncer } from '../audio/use-announcer';
import { EventBanner } from '../components/EventBanner';
import { Keypad } from '../components/Keypad';
import { MatchHeader } from '../components/MatchHeader';
import { MatchStatsPanel } from '../components/MatchStatsPanel';
import { MatchSummaryPanel } from '../components/MatchSummaryPanel';
import { Scoreboard } from '../components/Scoreboard';
import { TurnPanel } from '../components/TurnPanel';
import { WarningIcon } from '../components/icons';
import { pl } from '../i18n/pl';

const NEW_GAME_HREF = '#/';

const link = 'text-xl font-semibold uppercase text-(--color-text) underline';

export function GameScreen({ matchId }: { matchId: string }) {
  const audio = useAnnouncer();
  const { state, lastTurn, banner, error, busy, connection, notFound, sendHit, sendUndo } = useMatch(matchId, audio.onLiveMessage);
  // Zabawa i trening potrzebują podsumowania dopiero po końcu gry. Free run nigdy się nie kończy.
  const stats = useMatchSummary(matchId, state?.eventSeq ?? null, state !== null && (state.type === 'match' || state.finished));

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

  const keypadDisabled = !state || connection !== 'open';

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
          {state?.type === 'match' && <MatchStatsPanel state={state} summary={stats.summary} />}
        </div>
        <div className="relative flex flex-col gap-3">
          {connection === 'closed' && <Notice text={pl.connectionLost} />}
          {error && <Notice text={error} />}
          {state && <TurnPanel state={state} lastTurn={lastTurn} busy={busy} onUndo={sendUndo} />}
          {/* TurnPanel zostaje po końcu gry, żeby Cofnij poprawiło źle wpisaną zwycięską rzutkę. */}
          {state?.finished ? (
            <MatchSummaryPanel state={state} summary={stats.summary} error={stats.error} />
          ) : (
            <Keypad onHit={sendHit} disabled={keypadDisabled} />
          )}
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
