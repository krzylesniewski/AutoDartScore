import type { HeadToHead, Player } from '@autoscore/schema';
import { useEffect, useState } from 'react';
import { getHeadToHead } from '../api/client';
import { formatAverage } from '../game/format-stat';
import { pl } from '../i18n/pl';
import { WarningIcon } from './icons';

export interface HeadToHeadPanelProps {
  player: Pick<Player, 'id' | 'name'>;
  opponents: readonly Player[];
}

const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';
const chip = 'flex min-h-11 items-center gap-2 rounded-(--radius-card) border-(length:--border-width) px-4 font-display text-xl';

function chipStyle(selected: boolean): string {
  return `${chip} ${selected ? 'border-(--color-text) bg-(--color-text) text-(--color-text-inverse)' : 'border-(--color-border-strong) bg-(--color-surface) text-(--color-text)'}`;
}

type Result = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; value: HeadToHead } | { status: 'error' };

export function HeadToHeadPanel({ player, opponents }: HeadToHeadPanelProps) {
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [result, setResult] = useState<Result>({ status: 'idle' });
  const opponent = opponents.find((candidate) => candidate.id === opponentId);

  useEffect(() => {
    if (opponentId === null) {
      return;
    }
    let cancelled = false;
    setResult({ status: 'loading' });
    getHeadToHead(player.id, opponentId).then(
      (value) => {
        if (!cancelled) {
          setResult({ status: 'ready', value });
        }
      },
      () => {
        if (!cancelled) {
          setResult({ status: 'error' });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [player.id, opponentId]);

  return (
    <section aria-labelledby="head-to-head" className="flex flex-col gap-3">
      <h2 id="head-to-head" className={label}>
        {pl.headToHead}
      </h2>
      {opponents.length === 0 ? (
        <p className="text-(--color-text-muted)">{pl.noOpponents}</p>
      ) : (
        <div role="group" aria-label={pl.opponent} className="flex flex-wrap gap-2">
          {opponents.map((candidate) => (
            <button key={candidate.id} type="button" aria-pressed={candidate.id === opponentId} onClick={() => setOpponentId(candidate.id)} className={chipStyle(candidate.id === opponentId)}>
              {candidate.avatar && <span aria-hidden="true">{candidate.avatar}</span>}
              {candidate.name}
            </button>
          ))}
        </div>
      )}
      {opponents.length > 0 && result.status === 'idle' && <p className="text-(--color-text-muted)">{pl.pickOpponent}</p>}
      {result.status === 'loading' && <p className="text-(--color-text-muted)">{pl.loading}</p>}
      {result.status === 'error' && (
        <p className="flex items-center gap-2 font-display text-xl text-(--color-accent)">
          <WarningIcon />
          {pl.headToHeadFailed}
        </p>
      )}
      {result.status === 'ready' && result.value.matchesPlayed === 0 && <p className="font-display text-2xl text-(--color-text-muted)">{pl.headToHeadEmpty}</p>}
      {result.status === 'ready' && result.value.matchesPlayed > 0 && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-(--radius-card) border-(length:--border-width) border-(--color-border) bg-(--color-surface) p-5 sm:grid-cols-4">
          {(
            [
              [pl.headToHeadMatches, pl.legsState(result.value.matchesWon, result.value.opponentMatchesWon)],
              [pl.headToHeadLegs, pl.legsState(result.value.legsWon, result.value.opponentLegsWon)],
              [pl.headToHeadAverage(player.name), formatAverage(result.value.average)],
              [pl.headToHeadAverage(opponent?.name ?? ''), formatAverage(result.value.opponentAverage)],
            ] as const
          ).map(([term, value], index) => (
            <div key={index} className="flex flex-col gap-1">
              <dt className={label}>{term}</dt>
              <dd className="font-display text-3xl font-bold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
