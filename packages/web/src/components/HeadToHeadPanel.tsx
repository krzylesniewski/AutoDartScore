import type { HeadToHead, Player } from '@autoscore/schema';
import { useEffect, useState } from 'react';
import { getHeadToHead } from '../api/client';
import { formatAverage } from '../game/format-stat';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';
import { CardRings } from './CardRings';
import { WarningIcon } from './icons';

export interface HeadToHeadPanelProps {
  player: Pick<Player, 'id' | 'name'>;
  opponents: readonly Player[];
}

const chip = 'flex min-h-11 max-w-full items-center gap-2 rounded-(--radius-button) pr-4 pl-2 font-display text-[19px]';

function chipStyle(selected: boolean): string {
  return `${chip} ${selected ? 'bg-(--color-text) font-extrabold text-(--color-text-inverse) shadow-(--shadow-selected)' : 'bg-(--color-surface-soft) font-bold text-(--color-text) shadow-(--shadow-inset-line)'}`;
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
    <section aria-labelledby="head-to-head" className="sc-panel sc-panel--flat">
      <CardRings className="-top-15 -right-12 size-44" />
      {/* Treść ma relative, żeby stała nad dekoracją w rogu. */}
      <div className="relative flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h2 id="head-to-head" className="font-display text-[26px] leading-tight font-extrabold">
            {pl.headToHead}
          </h2>
          {opponents.length === 0 ? (
            <p className="text-(--color-text-muted)">{pl.noOpponents}</p>
          ) : (
            <div role="group" aria-label={pl.opponent} className="flex min-w-0 flex-wrap gap-2">
              {opponents.map((candidate) => (
                <button key={candidate.id} type="button" aria-pressed={candidate.id === opponentId} onClick={() => setOpponentId(candidate.id)} className={chipStyle(candidate.id === opponentId)}>
                  <Avatar name={candidate.name} avatar={candidate.avatar} color={candidate.color} />
                  <span className="min-w-0 truncate">{candidate.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {opponents.length > 0 && result.status === 'idle' && <p className="text-(--color-text-muted)">{pl.pickOpponent}</p>}
        {result.status === 'loading' && <p className="text-(--color-text-muted)">{pl.loading}</p>}
        {result.status === 'error' && (
          <p className="flex items-center gap-2 font-display text-xl text-(--color-text)">
            <WarningIcon className="text-(--color-accent)" />
            {pl.headToHeadFailed}
          </p>
        )}
        {result.status === 'ready' && result.value.matchesPlayed === 0 && <p className="font-display text-2xl text-(--color-text-muted)">{pl.headToHeadEmpty}</p>}
        {result.status === 'ready' && result.value.matchesPlayed > 0 && <Results value={result.value} playerName={player.name} opponentName={opponent?.name ?? ''} />}
      </div>
    </section>
  );
}

interface ResultsProps {
  value: HeadToHead;
  playerName: string;
  opponentName: string;
}

function Results({ value, playerName, opponentName }: ResultsProps) {
  return (
    <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-2">
      {(
        [
          [pl.headToHeadMatches, pl.legsState(value.matchesWon, value.opponentMatchesWon)],
          [pl.headToHeadLegs, pl.legsState(value.legsWon, value.opponentLegsWon)],
          [pl.headToHeadAverage(playerName), formatAverage(value.average)],
          [pl.headToHeadAverage(opponentName), formatAverage(value.opponentAverage)],
        ] as const
      ).map(([term, shown], index) => (
        <div
          key={index}
          className="flex min-w-0 flex-col gap-1 rounded-(--radius-card) bg-linear-to-b from-(--color-surface-raised) to-(--color-surface) px-4.5 py-2.5 shadow-(--shadow-key)"
        >
          <dt className="font-display text-sm font-bold tracking-[0.12em] wrap-anywhere text-(--color-text-muted) uppercase">{term}</dt>
          <dd className="font-display text-[34px] leading-none font-extrabold tabular-nums">{shown}</dd>
        </div>
      ))}
    </dl>
  );
}
