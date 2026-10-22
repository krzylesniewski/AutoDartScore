import type { MatchListItem, MatchType } from '@autoscore/schema';
import { useCallback, useEffect, useState } from 'react';
import { abandonMatch, listMatches } from '../api/client';
import { AbandonDialog } from '../components/AbandonDialog';
import { AppNav } from '../components/AppNav';
import { MatchHistoryList } from '../components/MatchHistoryList';
import { Notice } from '../components/Notice';
import { WarningIcon } from '../components/icons';
import { pl } from '../i18n/pl';

// Trening obejmuje też Free run, bo historia to nie statystyki.
const FILTERS: readonly { value: MatchType | null; label: string }[] = [
  { value: null, label: pl.filterAll },
  { value: 'match', label: pl.filterMatch },
  { value: 'casual', label: pl.typeCasual },
  { value: 'practice', label: pl.typePractice },
];

const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';
const choice = 'min-h-12 rounded-(--radius-card) border-(length:--border-width) px-4 font-display text-xl';

function choiceStyle(selected: boolean): string {
  return `${choice} ${selected ? 'border-(--color-text) bg-(--color-text) text-(--color-text-inverse)' : 'border-(--color-border-strong) bg-(--color-surface) text-(--color-text)'}`;
}

type Games = { status: 'loading' } | { status: 'ready'; games: MatchListItem[] } | { status: 'error' };

export function HistoryScreen() {
  const [type, setType] = useState<MatchType | null>(null);
  const [games, setGames] = useState<Games>({ status: 'loading' });
  const [abandoning, setAbandoning] = useState<MatchListItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGames({ status: 'loading' });
    listMatches(type ? { type } : {}).then(
      (value) => {
        if (!cancelled) {
          setGames({ status: 'ready', games: value });
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
  }, [type]);

  async function abandon(game: MatchListItem, playerId: string, reason: string | null): Promise<void> {
    setAbandoning(null);
    setBusy(true);
    setNotice(null);
    try {
      const state = await abandonMatch(game.id, playerId, reason);
      // Wiersz zmienia się na miejscu, bez ponownego pobrania listy: lista nie miga i zostaje przewinięta tam, gdzie była.
      const updated: MatchListItem = { ...game, status: state.status, abandonment: state.abandonment, updatedAt: state.abandonment?.at ?? game.updatedAt };
      setGames((current) => (current.status === 'ready' ? { status: 'ready', games: current.games.map((item) => (item.id === game.id ? updated : item)) } : current));
    } catch {
      setNotice(pl.abandonFailed);
    } finally {
      setBusy(false);
    }
  }

  const closeAbandon = useCallback(() => setAbandoning(null), []);

  return (
    <div className="flex h-full flex-col">
      <AppNav current="history" />
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-12 pt-7 pb-8">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-[56px] leading-none font-bold uppercase">{pl.history}</h1>
            <p className="text-[17px] text-(--color-text-muted)">{pl.historySubtitle}</p>
          </div>
          <section aria-labelledby="history-filter" className="flex flex-col gap-2.5">
            <h2 id="history-filter" className={label}>
              {pl.gameType}
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {FILTERS.map((option) => (
                <button key={option.label} type="button" aria-pressed={type === option.value} onClick={() => {
                    setType(option.value);
                    setNotice(null);
                  }} className={choiceStyle(type === option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
          </section>
        </div>
        {notice && (
          <div role="alert">
            <Notice text={notice} />
          </div>
        )}
        {games.status === 'loading' && <p className="text-(--color-text-muted)">{pl.loading}</p>}
        {games.status === 'error' && (
          <p className="flex items-center gap-2 font-display text-xl text-(--color-accent)">
            <WarningIcon />
            {pl.loadMatchesFailed}
          </p>
        )}
        {games.status === 'ready' && (
          <div className="rounded-(--radius-card) border-(length:--border-width) border-(--color-border) bg-(--color-surface) px-7 py-3">
            <MatchHistoryList games={games.games} now={new Date()} busy={busy} onAbandon={setAbandoning} />
          </div>
        )}
      </main>
      {abandoning && <AbandonDialog state={abandoning} onCancel={closeAbandon} onConfirm={(playerId, reason) => void abandon(abandoning, playerId, reason)} />}
    </div>
  );
}
