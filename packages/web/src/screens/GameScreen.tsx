import type { Hit } from '@autoscore/schema';
import { useCallback, useState, type ReactNode } from 'react';
import { useFrequentHits } from '../api/use-frequent-hits';
import { useMatch } from '../api/use-match';
import { useMatchSummary } from '../api/use-match-summary';
import { useAnnouncer } from '../audio/use-announcer';
import { AbandonDialog } from '../components/AbandonDialog';
import { CheckoutActions, CheckoutRecentAttempts, CheckoutTargetCard } from '../components/CheckoutPracticePanel';
import { CheckoutPracticeSummary } from '../components/CheckoutPracticeSummary';
import { EndPracticeDialog } from '../components/EndPracticeDialog';
import { EventBanner } from '../components/EventBanner';
import { Keypad } from '../components/Keypad';
import { MatchEndView } from '../components/MatchEndView';
import { MatchHeader } from '../components/MatchHeader';
import { MatchStatsPanel } from '../components/MatchStatsPanel';
import { MatchSummaryPanel } from '../components/MatchSummaryPanel';
import { Scoreboard } from '../components/Scoreboard';
import { TurnPanel } from '../components/TurnPanel';
import { LockIcon, WarningIcon } from '../components/icons';
import { canEndPractice } from '../game/can-end-practice';
import { checkoutControls } from '../game/checkout-practice';
import { checkoutRoute } from '../game/checkout-route';
import { formatCountdown } from '../game/undo-window';
import { useUndoWindow } from '../game/use-undo-window';
import { pl } from '../i18n/pl';

const NEW_GAME_HREF = '#/';
const HOME_HREF = '#/';

const link = 'text-xl font-semibold uppercase text-(--color-text) underline';

export function GameScreen({ matchId }: { matchId: string }) {
  const audio = useAnnouncer();
  const { state, lastTurn, banner, achievements, error, busy, connection, notFound, sendHit, sendRestMiss, sendUndo, sendAbandon, sendResume, sendEndPractice, sendCheckoutAttempt, sendCheckoutSkip } = useMatch(
    matchId,
    audio.onLiveMessage,
  );
  // Zabawa i trening potrzebują podsumowania dopiero po końcu gry. Free run nigdy się nie kończy.
  const stats = useMatchSummary(matchId, state?.eventSeq ?? null, state !== null && (state.type === 'match' || state.finished));
  const checkoutMode = state?.practiceMode === 'checkouts';
  // Trening końcówek nie ma klawiatury, więc podpowiedzi trafień są zbędne.
  const frequentHits = useFrequentHits(state && !state.finished && !checkoutMode ? state.currentPlayerId : null);
  const [abandoning, setAbandoning] = useState(false);
  const closeDialog = useCallback(() => setAbandoning(false), []);
  const [ending, setEnding] = useState(false);
  const closeEndDialog = useCallback(() => setEnding(false), []);
  const undoWindow = useUndoWindow(state);
  const checkouts = checkoutMode ? state.checkouts : null;
  const controls = state ? checkoutControls(state, connection === 'open') : { results: false, skip: false, undo: false };

  // Jak w enterCheckout: w trakcie komendy widoczny cel jest nieaktualny, więc skrót niczego nie wysyła.
  function recordAttempt(success: boolean): void {
    if (busy || !controls.results) {
      return;
    }
    sendCheckoutAttempt(success);
  }

  function skipCheckout(): void {
    if (busy || !controls.skip) {
      return;
    }
    sendCheckoutSkip();
  }

  function undoAttempt(): void {
    if (busy || !controls.undo) {
      return;
    }
    sendUndo();
  }

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
  const checkout = state ? (checkoutRoute(state)?.[0] ?? null) : null;
  const thrower = state?.players.find((player) => player.id === state.currentPlayerId);
  const frequent = thrower && frequentHits && frequentHits.length > 0 ? { playerName: thrower.name, hits: frequentHits } : null;

  // W trakcie komendy trasa pochodzi ze starego stanu, więc podwójne kliknięcie albo szybki drugi Enter nie wysyła nieaktualnej rzutki.
  function enterCheckout(hit: Hit): void {
    if (busy || keypadDisabled) {
      return;
    }
    sendHit(hit);
  }

  // Odmowa serwera wygrywa z zegarem urządzenia. Tekst blokady pokazujemy raz, zamiast błędu cofnięcia.
  const lockedByServer = state?.finished === true && error === pl.matchLocked;
  const undoLocked = undoWindow.locked || lockedByServer;
  const shownError = lockedByServer ? null : error;
  const undoCountdown = !undoLocked && undoWindow.secondsLeft !== null ? formatCountdown(undoWindow.secondsLeft) : null;

  if (state?.type === 'match' && state.finished) {
    return (
      <MatchEndView
        state={state}
        summary={stats.summary}
        summaryError={stats.error}
        error={shownError}
        connectionLost={connection === 'closed'}
        busy={busy}
        undoLocked={undoLocked}
        undoCountdown={undoCountdown}
        onUndo={sendUndo}
        voiceEnabled={audio.voiceEnabled}
        onVoiceChange={audio.setVoiceEnabled}
        effectsEnabled={audio.effectsEnabled}
        onEffectsChange={audio.setEffectsEnabled}
        achievements={achievements}
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
      {/* Opakowanie nie przewija się, więc baner poniżej lg trzyma się góry widocznego obszaru.
          Poniżej lg main jest kolumną flex, a prawa kolumna ma display: contents. Dok jest wtedy dzieckiem main.
          Sticky trzyma go na dole przez całe przewijanie, a mt-auto także wtedy, gdy treść jest krótsza niż ekran. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <main className="flex min-h-0 flex-1 flex-col content-start gap-3 overflow-auto px-3 pt-3 sm:gap-(--space-page) sm:px-(--space-page) sm:pt-(--space-page) lg:grid lg:grid-cols-[340px_1fr] lg:pb-3 xl:grid-cols-[var(--scoreboard-width)_1fr]">
          <div className="flex flex-col gap-4">
            {state ? <Scoreboard state={state} size="large" /> : <p className="font-display text-(--color-text-muted)">{pl.loading}</p>}
            {state?.type === 'match' && <MatchStatsPanel state={state} summary={stats.summary} />}
            {checkouts && <CheckoutRecentAttempts session={checkouts} />}
          </div>
          <div className="contents lg:relative lg:flex lg:flex-col lg:gap-3">
            {state && !checkoutMode && (
              <TurnPanel
                state={state}
                lastTurn={lastTurn}
                busy={busy}
                undoDisabled={abandoned || ended || undoLocked}
                undoCountdown={undoCountdown}
                onUndo={sendUndo}
                onCheckout={enterCheckout}
                checkoutDisabled={keypadDisabled}
              />
            )}
            {checkouts && !ended && <CheckoutTargetCard session={checkouts} />}
            {/* Od lg komunikat o końcu treningu leży na górze prawej kolumny, więc podsumowanie zaczyna się pod nim. */}
            {checkouts && ended && (
              <div className="lg:mt-15">
                <CheckoutPracticeSummary session={checkouts} />
              </div>
            )}
            {/* TurnPanel zostaje po końcu gry, żeby Cofnij poprawiło źle wpisaną zwycięską rzutkę. */}
            {state?.finished && <MatchSummaryPanel state={state} summary={stats.summary} error={stats.error} />}
            {/* Od lg dok znika z układu, a komunikaty nakładają się na górę prawej kolumny, żeby nie przesuwać klawiatury. */}
            <div
              className="sticky bottom-0 z-10 mt-auto flex flex-col gap-3 bg-(--color-bg) pt-3 pb-[calc(12px_+_env(safe-area-inset-bottom))] sm:pb-[calc(var(--space-page)_+_env(safe-area-inset-bottom))] lg:contents"
            >
              <div className="flex flex-col gap-3 empty:hidden lg:absolute lg:inset-x-0 lg:top-0 lg:z-20">
                {connection === 'closed' && <Notice text={pl.connectionLost} />}
                {shownError && <Notice text={shownError} />}
                {undoLocked && <Notice text={pl.matchLocked} icon={<LockIcon className="text-(--color-accent)" />} />}
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
              {checkouts && !ended && (
                <CheckoutActions
                  resultsDisabled={!controls.results}
                  skipDisabled={!controls.skip}
                  undoDisabled={!controls.undo}
                  busy={busy}
                  onResult={recordAttempt}
                  onSkip={skipCheckout}
                  onUndo={undoAttempt}
                />
              )}
              {!state?.finished && !checkoutMode && (
                <Keypad
                  onHit={sendHit}
                  onRestMiss={sendRestMiss}
                  onUndo={sendUndo}
                  disabled={keypadDisabled}
                  undoDisabled={busy || abandoned || ended}
                  checkout={busy ? null : checkout}
                  frequent={frequent}
                />
              )}
            </div>
            {/* Baner jest poza dokiem. Wiszący nad przypiętym dokiem zasłaniałby Cofnij po przewinięciu na dół. */}
            <EventBanner banner={banner} achievements={achievements} />
          </div>
        </main>
      </div>
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

function Notice({ text, icon = <WarningIcon className="text-(--color-accent)" />, children }: { text: string; icon?: ReactNode; children?: ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-(--radius-card) border-(length:--border-width) border-(--color-accent) bg-(--color-surface) px-4 py-2 font-display text-xl text-(--color-text)">
      {icon}
      {text}
      {children}
    </p>
  );
}
