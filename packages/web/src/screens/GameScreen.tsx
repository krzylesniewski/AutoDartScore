import { useCallback, useState, type ReactNode } from 'react';
import { useMatch } from '../api/use-match';
import { useMatchSummary } from '../api/use-match-summary';
import { useAnnouncer } from '../audio/use-announcer';
import { AbandonDialog } from '../components/AbandonDialog';
import { EndPracticeDialog } from '../components/EndPracticeDialog';
import { EventBanner } from '../components/EventBanner';
import { Keypad } from '../components/Keypad';
import { MatchEndView } from '../components/MatchEndView';
import { MatchHeader } from '../components/MatchHeader';
import { MatchStatsPanel } from '../components/MatchStatsPanel';
import { MatchSummaryPanel } from '../components/MatchSummaryPanel';
import { Scoreboard } from '../components/Scoreboard';
import { TurnPanel } from '../components/TurnPanel';
import { WarningIcon } from '../components/icons';
import { canEndPractice } from '../game/can-end-practice';
import { pl } from '../i18n/pl';

const NEW_GAME_HREF = '#/';
const HOME_HREF = '#/';

const link = 'text-xl font-semibold uppercase text-(--color-text) underline';

export function GameScreen({ matchId }: { matchId: string }) {
  const audio = useAnnouncer();
  const { state, lastTurn, banner, error, busy, connection, notFound, sendHit, sendUndo, sendAbandon, sendResume, sendEndPractice } = useMatch(matchId, audio.onLiveMessage);
  // Zabawa i trening potrzebują podsumowania dopiero po końcu gry. Free run nigdy się nie kończy.
  const stats = useMatchSummary(matchId, state?.eventSeq ?? null, state !== null && (state.type === 'match' || state.finished));
  const [abandoning, setAbandoning] = useState(false);
  const closeDialog = useCallback(() => setAbandoning(false), []);
  const [ending, setEnding] = useState(false);
  const closeEndDialog = useCallback(() => setEnding(false), []);

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

  const abandoned = state?.status === 'abandoned';
  const ended = state?.status === 'ended';
  // Gra mogła się zmienić na innym urządzeniu. Wtedy okno znika i nie wraca samo po wznowieniu.
  if (abandoning && state && state.status !== 'in_progress') {
    setAbandoning(false);
  }
  // To samo dla końca treningu: inne urządzenie mogło go zakończyć albo cofnąć wszystkie rzutki.
  if (ending && state && !canEndPractice(state)) {
    setEnding(false);
  }
  const keypadDisabled = !state || abandoned || ended || connection !== 'open';

  if (state?.type === 'match' && state.finished) {
    return (
      <MatchEndView
        state={state}
        summary={stats.summary}
        summaryError={stats.error}
        error={error}
        connectionLost={connection === 'closed'}
        busy={busy}
        onUndo={sendUndo}
        voiceEnabled={audio.voiceEnabled}
        onVoiceChange={audio.setVoiceEnabled}
        effectsEnabled={audio.effectsEnabled}
        onEffectsChange={audio.setEffectsEnabled}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <MatchHeader
        state={state}
        voiceEnabled={audio.voiceEnabled}
        onVoiceChange={audio.setVoiceEnabled}
        effectsEnabled={audio.effectsEnabled}
        onEffectsChange={audio.setEffectsEnabled}
        onAbandon={() => setAbandoning(true)}
        onResume={sendResume}
        onEndPractice={() => setEnding(true)}
      />
      {/* Poniżej lg main jest kolumną flex, a prawa kolumna ma display: contents. Dok jest wtedy dzieckiem main,
          więc sticky trzyma go na dole przez całe przewijanie, także gdy długi pasek wyników spycha turę pod ekran. */}
      <main className="flex min-h-0 flex-1 flex-col content-start gap-3 overflow-auto px-3 pt-3 sm:gap-(--space-page) sm:px-(--space-page) sm:pt-(--space-page) lg:grid lg:grid-cols-[340px_1fr] lg:pb-(--space-page) xl:grid-cols-[var(--scoreboard-width)_1fr]">
        <div className="flex flex-col gap-4">
          {state ? <Scoreboard state={state} size="large" /> : <p className="font-display text-(--color-text-muted)">{pl.loading}</p>}
          {state?.type === 'match' && <MatchStatsPanel state={state} summary={stats.summary} />}
        </div>
        <div className="contents lg:relative lg:flex lg:flex-col lg:gap-3">
          {state && <TurnPanel state={state} lastTurn={lastTurn} busy={busy} undoDisabled={abandoned || ended} onUndo={sendUndo} />}
          {/* TurnPanel zostaje po końcu gry, żeby Cofnij poprawiło źle wpisaną zwycięską rzutkę. */}
          {state?.finished && <MatchSummaryPanel state={state} summary={stats.summary} error={stats.error} />}
          {/* Od lg dok znika z układu: komunikaty wracają nad turę, a baner pozycjonuje się względem prawej kolumny. */}
          <div
            className="sticky bottom-0 z-10 flex flex-col gap-3 bg-(--color-bg) pt-3 pb-[calc(12px_+_env(safe-area-inset-bottom))] sm:pb-[calc(var(--space-page)_+_env(safe-area-inset-bottom))] lg:contents"
          >
            <div className="flex flex-col gap-3 empty:hidden lg:order-first">
              {connection === 'closed' && <Notice text={pl.connectionLost} />}
              {error && <Notice text={error} />}
              {abandoned && (
                <Notice text={pl.abandonedReadOnly}>
                  <a href={HOME_HREF} className="ml-auto underline">
                    {pl.home}
                  </a>
                </Notice>
              )}
              {ended && (
                <Notice text={pl.practiceEndedReadOnly}>
                  <a href={HOME_HREF} className="ml-auto underline">
                    {pl.home}
                  </a>
                </Notice>
              )}
            </div>
            {!state?.finished && <Keypad onHit={sendHit} disabled={keypadDisabled} />}
            <EventBanner banner={banner} />
          </div>
        </div>
      </main>
      {abandoning && state && (
        <AbandonDialog
          state={state}
          onCancel={closeDialog}
          onConfirm={(playerId, reason) => {
            setAbandoning(false);
            sendAbandon(playerId, reason);
          }}
        />
      )}
      {ending && (
        <EndPracticeDialog
          onCancel={closeEndDialog}
          onConfirm={() => {
            setEnding(false);
            sendEndPractice();
          }}
        />
      )}
    </div>
  );
}

function Notice({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-(--radius-card) border-(length:--border-width) border-(--color-accent) bg-(--color-surface) px-4 py-2 font-display text-xl text-(--color-text)">
      <WarningIcon className="text-(--color-accent)" />
      {text}
      {children}
    </p>
  );
}
