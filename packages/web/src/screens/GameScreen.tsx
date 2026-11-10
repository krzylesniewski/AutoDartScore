import type { Hit } from '@autoscore/schema';
import { useCallback, useId, useRef, useState, type ReactNode } from 'react';
import { useFrequentHits } from '../api/use-frequent-hits';
import { useMatch } from '../api/use-match';
import { useMatchSummary } from '../api/use-match-summary';
import { useAnnouncer } from '../audio/use-announcer';
import { AbandonDialog } from '../components/AbandonDialog';
import { CheckoutCard } from '../components/CheckoutCard';
import { CheckoutActions, CheckoutRecentAttempts, CheckoutTargetCard } from '../components/CheckoutPracticePanel';
import { CheckoutPracticeSummary } from '../components/CheckoutPracticeSummary';
import { EndPracticeDialog } from '../components/EndPracticeDialog';
import { EventBanner } from '../components/EventBanner';
import { Keypad } from '../components/Keypad';
import { LegInfo } from '../components/LegInfo';
import { MatchEndView } from '../components/MatchEndView';
import { MatchHeader } from '../components/MatchHeader';
import { MatchStatsPanel } from '../components/MatchStatsPanel';
import { MatchSummaryPanel } from '../components/MatchSummaryPanel';
import { Scoreboard } from '../components/Scoreboard';
import { TurnPanel } from '../components/TurnPanel';
import { UndoButton } from '../components/UndoButton';
import { LockIcon, WarningIcon } from '../components/icons';
import { canEndPractice } from '../game/can-end-practice';
import { checkoutControls } from '../game/checkout-practice';
import { checkoutRoute } from '../game/checkout-route';
import { formatCountdown } from '../game/undo-window';
import { useUndoWindow } from '../game/use-undo-window';
import { pl } from '../i18n/pl';

const NEW_GAME_HREF = '#/';
const HOME_HREF = '#/';

const noticeLink = 'ml-auto inline-flex min-h-11 items-center underline text-(--color-text)';

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
  const [turnsOpen, setTurnsOpen] = useState(false);
  const turnsButtonRef = useRef<HTMLButtonElement>(null);
  const legInfoId = useId();
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
      <main className="flex h-full flex-col items-center justify-center p-(--space-page)">
        <div className="sc-panel max-w-full items-center gap-5 px-8 py-7 text-center">
          <p className="flex items-center gap-2.5 font-display text-3xl font-bold text-(--color-text)">
            <WarningIcon className="shrink-0 text-(--color-accent)" />
            {pl.matchNotFound}
          </p>
          <a href={NEW_GAME_HREF} className="sc-btn sc-btn--outline">
            {pl.newGame}
          </a>
        </div>
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
  const undoDisabled = busy || abandoned || ended || undoLocked;
  const legInfoShown = state !== null && !checkoutMode;
  // Poniżej lg otwarty panel lega zajmuje miejsce paska wyników, panelu tury i karty zamknięcia. Od lg przełącznik nic nie zmienia.
  const hiddenByTurns = turnsOpen ? 'max-lg:hidden' : '';

  function closeTurns(): void {
    setTurnsOpen(false);
    turnsButtonRef.current?.focus();
  }

  if ((state?.type === 'match' || state?.type === 'casual') && state.finished) {
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
        turns={legInfoShown ? { open: turnsOpen, controls: legInfoId, onToggle: () => setTurnsOpen(!turnsOpen), buttonRef: turnsButtonRef } : undefined}
      />
      {/* Opakowanie nie przewija się, więc baner poniżej lg trzyma się góry widocznego obszaru.
          Poniżej lg main jest kolumną flex, a prawa kolumna ma display: contents. Dok jest wtedy dzieckiem main.
          Sticky trzyma go na dole przez całe przewijanie, a mt-auto także wtedy, gdy treść jest krótsza niż ekran.
          Karta zamknięcia jest w DOM raz: od lg na dole lewej kolumny, poniżej lg przez order między panelem tury a dokiem.
          Od lg lewa kolumna przewija się sama, więc rosnąca historia tur nie przesuwa karty zamknięcia ani klawiatury.
          Ujemny margines z równym paddingiem daje miejsce na cień karty rzucającego, który kontener przewijania by przyciął. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <main className="flex min-h-0 flex-1 flex-col content-start gap-3 overflow-auto px-3 pt-3 sm:gap-(--space-page) sm:px-(--space-page) sm:pt-(--space-page) lg:grid lg:grid-cols-[340px_1fr] lg:grid-rows-[1fr_auto] lg:pb-3 xl:grid-cols-[var(--scoreboard-width)_1fr]">
          <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1 lg:-mx-(--space-page) lg:-mt-1 lg:min-h-0 lg:overflow-x-hidden lg:overflow-y-auto lg:px-(--space-page) lg:pt-1 lg:pb-1">
            <div className={`contents ${hiddenByTurns}`}>
              {state ? <Scoreboard state={state} size="large" /> : <p className="font-display text-(--color-text-muted)">{pl.loading}</p>}
              {state?.type === 'match' && <MatchStatsPanel state={state} summary={stats.summary} />}
              {checkouts && <CheckoutRecentAttempts session={checkouts} />}
            </div>
            {/* Zamknięty panel zostaje w DOM poniżej lg, żeby aria-controls przycisku „Tury” wskazywało istniejący element. */}
            {state && legInfoShown && (
              <LegInfo state={state} id={legInfoId} onClose={closeTurns} className={`lg:min-h-[260px] lg:flex-1 ${turnsOpen ? '' : 'max-lg:hidden'}`} />
            )}
          </div>
          {state && !checkoutMode && (
            <div className={`empty:hidden max-lg:order-1 max-lg:has-[>.invisible]:hidden lg:col-start-1 lg:row-start-2 ${hiddenByTurns}`}>
              <CheckoutCard state={state} onCheckout={enterCheckout} disabled={keypadDisabled} />
            </div>
          )}
          <div className="contents lg:relative lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-(--space-6)">
            {state && !checkoutMode && (
              <div className={`contents ${hiddenByTurns}`}>
                <TurnPanel state={state} lastTurn={lastTurn} />
              </div>
            )}
            {checkouts && !ended && <CheckoutTargetCard session={checkouts} />}
            {/* Od lg komunikat o końcu treningu leży na górze prawej kolumny, więc podsumowanie zaczyna się pod nim. */}
            {checkouts && ended && (
              <div className="lg:mt-15">
                <CheckoutPracticeSummary session={checkouts} />
              </div>
            )}
            {/* Tu dochodzi tylko zakończone Solo 501. Klawiatura znika, a Cofnij zostaje osobno, żeby poprawić źle wpisaną zwycięską rzutkę. */}
            {state?.finished && !checkoutMode && <UndoButton onUndo={sendUndo} disabled={undoDisabled} countdown={undoCountdown} className="h-14" />}
            {state?.finished && <MatchSummaryPanel state={state} summary={stats.summary} error={stats.error} />}
            {/* Od lg dok znika z układu, a komunikaty nakładają się na górę prawej kolumny, żeby nie przesuwać klawiatury. */}
            <div
              className="sticky bottom-0 z-10 mt-auto flex flex-col gap-3 bg-(--color-bg) pt-3 max-lg:order-2 pb-[calc(12px_+_env(safe-area-inset-bottom))] sm:pb-[calc(var(--space-page)_+_env(safe-area-inset-bottom))] lg:contents"
            >
              <div className="flex flex-col gap-3 empty:hidden lg:absolute lg:inset-x-0 lg:top-0 lg:z-20">
                {connection === 'closed' && <Notice text={pl.connectionLost} />}
                {shownError && <Notice text={shownError} />}
                {undoLocked && <Notice text={pl.matchLocked} icon={<LockIcon className="text-(--color-accent)" />} />}
                {abandoned && (
                  <Notice text={pl.abandonedReadOnly}>
                    <a href={HOME_HREF} className={noticeLink}>
                      {pl.home}
                    </a>
                  </Notice>
                )}
                {ended && (
                  <Notice text={pl.practiceEndedReadOnly}>
                    <a href={HOME_HREF} className={noticeLink}>
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
                  undoDisabled={undoDisabled}
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
    // Od lg komunikat leży na panelu tury, więc tło musi być kryjące.
    <p className="flex items-center gap-2 rounded-(--radius-card) bg-linear-to-b from-(--color-surface-raised) to-(--color-surface) px-4 py-2 font-display text-xl text-(--color-text) shadow-(--shadow-card)">
      {icon}
      {text}
      {children}
    </p>
  );
}
