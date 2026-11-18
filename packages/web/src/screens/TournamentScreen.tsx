import type { Fixture, TournamentView } from '@autoscore/schema';
import { useId, useRef, useState } from 'react';
import { redrawTournament, startFixture } from '../api/client';
import { apiErrorText } from '../api/error-text';
import { useRunningLegs } from '../api/use-running-legs';
import { useTournament } from '../api/use-tournament';
import type { Connection } from '../api/use-match';
import { AppNav } from '../components/AppNav';
import { CorrectResultDialog } from '../components/CorrectResultDialog';
import { FixtureQueue } from '../components/FixtureQueue';
import { ShuffleIcon, TrophyIcon } from '../components/icons';
import { NextFixtureCard } from '../components/NextFixtureCard';
import { Notice } from '../components/Notice';
import { PlacementsCard } from '../components/PlacementsCard';
import { PlayoffBracket } from '../components/PlayoffBracket';
import { RunningFixtures } from '../components/RunningFixtures';
import { StandingsTable } from '../components/StandingsTable';
import { TournamentTabs, type TournamentTab } from '../components/TournamentTabs';
import { WithdrawPlayerDialog } from '../components/WithdrawPlayerDialog';
import { correctableFixtures, withdrawCandidates } from '../game/tournament-incidents';
import { tournamentProgress, type TournamentProgress } from '../game/tournament-progress';
import { FORMAT_LABELS } from '../game/tournament-setup';
import { pl } from '../i18n/pl';

export interface TournamentScreenProps {
  tournamentId: string;
}

type TabId = 'table' | 'playoff';

type CommandSource = 'redraw' | 'next' | 'queue';

type Incident = 'correct' | 'withdraw';

const incidentButton = 'sc-btn sc-btn--outline h-auto min-h-12 min-w-36 flex-1 py-2 text-lg font-bold';

interface CommandError {
  readonly source: CommandSource;
  readonly text: string;
}

function tabsFor(view: TournamentView): TournamentTab<TabId>[] {
  switch (view.format) {
    case 'league':
      return [{ id: 'table', label: pl.tabTable }];
    case 'group_playoff':
      return [
        { id: 'table', label: pl.tabGroup },
        { id: 'playoff', label: pl.tabPlayoff },
      ];
    default:
      return [{ id: 'playoff', label: pl.tabBracket }];
  }
}

function defaultTab(view: TournamentView): TabId {
  const phase = tournamentProgress(view).phase;
  if (view.format === 'group_playoff' && (phase === 'playoff' || phase === 'finished')) {
    return 'playoff';
  }
  return tabsFor(view)[0]?.id ?? 'table';
}

function progressText(progress: TournamentProgress): string {
  switch (progress.phase) {
    case 'finished':
      return pl.tournamentFinished;
    case 'league':
      return pl.phaseProgress(pl.formatLeague, progress.done, progress.total);
    case 'group':
      return pl.phaseProgress(pl.phaseGroup, progress.done, progress.total);
    default:
      return pl.phaseProgress(pl.phasePlayoff, progress.done, progress.total);
  }
}

export function TournamentScreen({ tournamentId }: TournamentScreenProps) {
  const { status, view, connection, accept, reload } = useTournament(tournamentId);

  return (
    <div className="flex h-full flex-col">
      <AppNav current="tournament" />
      <main className="flex min-h-0 flex-1 flex-col gap-(--space-6) overflow-auto px-4 pt-4 pb-6 sm:px-8 lg:px-(--space-page) lg:pt-6">
        {status === 'loading' && <p className="text-(--color-text-muted)">{pl.loading}</p>}
        {status === 'error' && <Notice text={pl.loadTournamentFailed} />}
        {status === 'not_found' && (
          <div className="flex flex-col items-start gap-3">
            <Notice text={pl.tournamentNotFound} />
            <a href="#/tournaments" className="inline-flex min-h-11 items-center text-lg text-(--color-text) underline underline-offset-4">
              {pl.backToTournaments}
            </a>
          </div>
        )}
        {status === 'ready' && view && <Tournament view={view} connection={connection} accept={accept} reload={reload} />}
      </main>
    </div>
  );
}

interface TournamentProps {
  view: TournamentView;
  connection: Connection;
  accept(view: TournamentView): void;
  reload(): void;
}

// Montuje się z pierwszym widokiem, więc domyślna zakładka wynika z niego, a późniejsze aktualizacje jej nie zmieniają.
function Tournament({ view, connection, accept, reload }: TournamentProps) {
  const baseId = useId();
  const [tab, setTab] = useState<TabId>(() => defaultTab(view));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CommandError | null>(null);
  const [incident, setIncident] = useState<Incident | null>(null);
  // Ref blokuje drugie kliknięcie w tym samym takcie, zanim stan zdąży wyłączyć przyciski.
  const pending = useRef(false);
  const live = useRunningLegs(view);

  const tabs = tabsFor(view);
  const progress = tournamentProgress(view);
  const canRedraw = view.canRedraw && view.status === 'in_progress' && view.archivedAt === null;
  // Poprawić wynik można też w zakończonym turnieju, a wycofać gracza tylko w trwającym.
  const canCorrect = view.archivedAt === null && correctableFixtures(view).length > 0;
  const canWithdraw = view.status === 'in_progress' && view.archivedAt === null && withdrawCandidates(view).length > 0;
  const tabId = (id: TabId) => `${baseId}-tab-${id}`;
  const panelId = (id: TabId) => `${baseId}-panel-${id}`;

  async function run(source: CommandSource, command: () => Promise<void>): Promise<void> {
    if (pending.current) {
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await command();
    } catch (caught) {
      setError({ source, text: apiErrorText(caught) });
      reload();
      pending.current = false;
      setBusy(false);
    }
  }

  function play(source: CommandSource, fixture: Fixture): void {
    void run(source, async () => {
      const result = await startFixture(view.id, fixture.id, view.eventSeq);
      accept(result.tournament);
      // Przyciski zostają wyłączone, bo zmiana adresu odmontowuje ten ekran.
      window.location.hash = `#/matches/${encodeURIComponent(result.matchId)}`;
    });
  }

  function redraw(): void {
    void run('redraw', async () => {
      accept(await redrawTournament(view.id, view.eventSeq));
      pending.current = false;
      setBusy(false);
    });
  }

  const errorAt = (source: CommandSource) => (error?.source === source ? error.text : null);

  function saved(next: TournamentView): void {
    accept(next);
    setIncident(null);
  }

  return (
    <>
      <header className="flex flex-wrap items-end gap-x-4.5 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="font-display text-(length:--text-label) font-bold tracking-[0.18em] text-(--color-text-muted) uppercase">
            {pl.tournamentLabel(FORMAT_LABELS[view.format], view.config.startingScore)}
          </p>
          <h1 className="font-display text-[length:clamp(2.5rem,8vw,3.5rem)] leading-[0.9] font-black break-words">{view.name}</h1>
        </div>
        <p className="inline-flex min-h-9 items-center gap-2 rounded-(--radius-pill) bg-(--color-surface-soft) px-3.5 py-1.5 text-[15px] tabular-nums shadow-(--shadow-inset-line)">
          {progress.phase === 'finished' ? (
            <TrophyIcon className="text-(--color-gold)" />
          ) : (
            <span aria-hidden="true" className="size-2.5 rounded-full bg-(--color-accent)" />
          )}
          {progressText(progress)}
        </p>
        <span aria-hidden="true" className="hidden grow lg:block" />
        <div className="flex max-w-full flex-wrap items-center gap-3">
          <TournamentTabs<TabId> tabs={tabs} selected={tab} onSelect={setTab} tabId={tabId} panelId={panelId} />
          {canRedraw && (
            <button type="button" disabled={busy} onClick={redraw} className="sc-btn sc-btn--outline">
              <ShuffleIcon />
              {pl.redraw}
            </button>
          )}
        </div>
      </header>
      {(connection === 'closed' || errorAt('redraw')) && (
        <div className="flex flex-col gap-3">
          {connection === 'closed' && <Notice text={pl.connectionLost} appearance="soft" />}
          {errorAt('redraw') && <Notice text={errorAt('redraw') ?? ''} appearance="soft" />}
        </div>
      )}
      <div className="grid grid-cols-1 content-start gap-(--space-page) lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[auto_1fr]">
        <div className="flex min-w-0 flex-col gap-(--space-page) lg:col-start-2 lg:row-start-1">
          <RunningFixtures view={view} live={live} />
          <NextFixtureCard view={view} busy={busy} error={errorAt('next')} onPlay={(fixture) => play('next', fixture)} />
        </div>
        <div
          role="tabpanel"
          id={panelId(tab)}
          aria-labelledby={tabId(tab)}
          tabIndex={0}
          className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1"
        >
          {tab === 'table' ? <StandingsTable view={view} /> : <PlayoffBracket view={view} live={live} />}
        </div>
        <div className="flex min-w-0 flex-col gap-(--space-page) lg:col-start-2 lg:row-start-2">
          {tab === 'playoff' && <PlacementsCard view={view} />}
          <FixtureQueue view={view} busy={busy} error={errorAt('queue')} onPlay={(fixture) => play('queue', fixture)} />
          {(canCorrect || canWithdraw) && (
            <div className="flex flex-wrap gap-2.5 lg:mt-auto">
              {canCorrect && (
                <button type="button" disabled={busy} onClick={() => setIncident('correct')} className={incidentButton}>
                  {pl.correctResult}
                </button>
              )}
              {canWithdraw && (
                <button type="button" disabled={busy} onClick={() => setIncident('withdraw')} className={incidentButton}>
                  {pl.withdrawPlayer}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {incident === 'correct' && <CorrectResultDialog view={view} onSaved={saved} onFailed={reload} onCancel={() => setIncident(null)} />}
      {incident === 'withdraw' && <WithdrawPlayerDialog view={view} onSaved={saved} onFailed={reload} onCancel={() => setIncident(null)} />}
    </>
  );
}
