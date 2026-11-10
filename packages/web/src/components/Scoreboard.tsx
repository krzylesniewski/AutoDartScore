import type { MatchSnapshot, MatchSnapshotPlayer } from '@autoscore/schema';
import { formatCheckoutPercent } from '../game/checkout-practice';
import { formatDecimal } from '../game/format-stat';
import { scoreboardOrder } from '../game/scoreboard-order';
import { type ScoreboardRowKind, scoreboardRowOffsets } from '../game/scoreboard-rows';
import { pl } from '../i18n/pl';
import { Avatar, type AvatarSize } from './Avatar';
import { CardRings } from './CardRings';
import { PlaceIcon, PlusIcon } from './icons';
import { ProgressBar } from './ProgressBar';

const MAX_PLAYERS = 4;

// Klasy jednego układu. Poniżej lg (i zawsze w rozmiarze compact) obowiązuje układ telefonu,
// od lg dochodzą klasy z prefiksem lg: z układu przestronnego (1v1, trening) albo zwartego (zabawa).
interface LayoutClasses {
  // Wysokości wierszy z odstępem pod wierszem (pb). Obrót kolejki przesuwa wiersze o sumę wysokości wierszy nad nimi.
  // Ustawione są zawsze wszystkie cztery, bo jedna niezdefiniowana zmienna unieważnia cały calc() i wiersze skaczą na górę.
  heights: string;
  gapCurrent: string;
  gap: string;
  currentCard: string;
  currentRings: string;
  currentWho: string;
  currentName: string;
  currentDesc: string;
  currentValue: string;
  currentScore: string;
  currentDots: string;
  bar: string;
  counter: string;
  counterTerm: string;
  counterValue: string;
  waitingCard: string;
  waitingRings: string | null;
  waitingName: string;
  waitingNext: string;
  waitingScore: string;
  waitingDots: string;
  placedCard: string;
  placedName: string;
}

const PHONE: LayoutClasses = {
  heights: '[--row-current:88px] [--row-waiting:60px] [--row-placed:60px] [--row-slot:58px]',
  gapCurrent: 'pb-1.5',
  gap: 'pb-1.5',
  currentCard: 'grid-cols-[auto_minmax(0,1fr)_auto_auto] grid-rows-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-3.5 py-2.5',
  currentRings: '-top-[52px] -right-[46px] size-[150px]',
  currentWho: 'gap-[3px]',
  currentName: 'text-2xl',
  currentDesc: 'text-[13px]',
  currentValue: 'col-start-4 row-start-1',
  currentScore: 'text-[62px]',
  currentDots: 'size-3',
  bar: 'row-start-2',
  counter: 'gap-3',
  counterTerm: 'text-[12px]',
  counterValue: 'text-[22px]',
  waitingCard: 'gap-x-2.5 gap-y-1 px-3.5 py-1.5',
  waitingRings: null,
  waitingName: 'text-xl',
  waitingNext: 'text-[12px]',
  waitingScore: 'text-[38px] leading-none',
  waitingDots: 'size-2.5',
  placedCard: 'gap-2.5 px-3.5',
  placedName: 'text-xl',
};

const LG_SHARED = {
  currentCard: 'lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:gap-x-3.5 lg:gap-y-0',
  currentRings: 'lg:-top-[70px] lg:-right-[70px] lg:size-[260px]',
  currentWho: 'lg:gap-1',
  currentName: 'lg:text-[34px]',
  currentDesc: 'lg:text-[15px]',
  currentValue: 'lg:col-span-full lg:row-start-2 lg:mb-2.5 lg:self-end lg:justify-self-end',
  currentScore: 'lg:text-[clamp(72px,28cqi,128px)]',
  currentDots: 'lg:size-[13px]',
  bar: 'lg:row-start-3',
  counter: 'lg:gap-5',
  counterTerm: 'lg:text-(length:--text-label)',
  counterValue: 'lg:text-[34px]',
  waitingDots: 'lg:size-[11px]',
  placedName: 'lg:text-[22px]',
};

const ROOMY: LayoutClasses = {
  ...LG_SHARED,
  heights: 'lg:[--row-current:244px] lg:[--row-waiting:122px] lg:[--row-placed:122px] lg:[--row-slot:122px]',
  gapCurrent: 'lg:pb-3.5',
  gap: 'lg:pb-3.5',
  currentCard: `${LG_SHARED.currentCard} lg:px-7 lg:pt-[22px] lg:pb-5`,
  waitingCard: 'lg:gap-x-3.5 lg:gap-y-0 lg:px-7 lg:pt-3.5 lg:pb-4',
  waitingRings: 'hidden lg:block lg:-top-[30px] lg:-right-10 lg:size-40',
  waitingName: 'lg:text-[28px]',
  waitingNext: 'lg:text-sm',
  waitingScore: 'lg:text-[clamp(48px,17cqi,76px)] lg:leading-[0.86]',
  placedCard: 'lg:gap-3 lg:pr-4 lg:pl-7',
};

const DENSE: LayoutClasses = {
  ...LG_SHARED,
  heights: 'lg:[--row-current:224px] lg:[--row-waiting:86px] lg:[--row-placed:62px] lg:[--row-slot:84px]',
  gapCurrent: 'lg:pb-2.5',
  gap: 'lg:pb-2',
  currentCard: `${LG_SHARED.currentCard} lg:px-6.5 lg:pt-5 lg:pb-[18px]`,
  waitingCard: 'lg:gap-x-3 lg:gap-y-0 lg:px-5.5 lg:pt-2.5 lg:pb-[11px]',
  waitingRings: null,
  waitingName: 'lg:text-2xl',
  waitingNext: 'lg:text-[13px]',
  waitingScore: 'lg:text-[clamp(40px,12.5cqi,56px)] lg:leading-[0.86]',
  placedCard: 'lg:gap-3 lg:pr-4 lg:pl-5.5',
};

interface AvatarSizes {
  current: AvatarSize;
  waiting: AvatarSize;
  placed: AvatarSize;
}

interface Layout {
  phone: LayoutClasses;
  lg: LayoutClasses | null;
  avatars: AvatarSizes;
}

type Size = 'large' | 'compact';

function layoutFor(size: Size, type: MatchSnapshot['type']): Layout {
  if (size === 'compact') {
    return { phone: PHONE, lg: null, avatars: { current: 'compactCurrent', waiting: 'compactWaiting', placed: 'compactWaiting' } };
  }
  if (type === 'casual') {
    return { phone: PHONE, lg: DENSE, avatars: { current: 'current', waiting: 'waitingDense', placed: 'placed' } };
  }
  return { phone: PHONE, lg: ROOMY, avatars: { current: 'current', waiting: 'waiting', placed: 'placed' } };
}

function classes(layout: Layout, key: Exclude<keyof LayoutClasses, 'waitingRings'>): string {
  return layout.lg ? `${layout.phone[key]} ${layout.lg[key]}` : layout.phone[key];
}

const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';

export interface ScoreboardProps {
  state: MatchSnapshot;
  size: Size;
  rotate?: boolean;
}

export function Scoreboard({ state, size, rotate = true }: ScoreboardProps) {
  const layout = layoutFor(size, state.type);
  const players = scoreboardOrder(state, rotate);
  const freeSlots = state.type === 'casual' && size === 'large' ? MAX_PLAYERS - state.players.length : 0;
  const nextId = nextPlayerId(state);
  const kinds: ScoreboardRowKind[] = [...players.map((player) => rowKind(state, player)), ...Array.from({ length: freeSlots }, () => 'slot' as const)];
  const { offsets, height } = scoreboardRowOffsets(kinds);
  const gapFor = (kind: ScoreboardRowKind) => classes(layout, kind === 'current' ? 'gapCurrent' : 'gap');
  const rowClass = 'absolute inset-x-0 top-0 transition-transform duration-300 ease-out motion-reduce:transition-none';

  return (
    <section aria-label={pl.scoreboard} className="@container flex flex-col gap-2">
      {size === 'large' && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <span className={label}>{pl.throwQueue}</span>
          {rotate && <span className="text-(--color-text-muted)">{pl.throwerOnTop}</span>}
        </div>
      )}
      {state.type === 'match' && state.legsToWin !== null && (
        <p className={label}>
          {pl.legs} {pl.legsTarget(state.legsToWin)}
        </p>
      )}
      <ol className={`relative ${classes(layout, 'heights')}`} style={{ height }}>
        {players.map((player, index) => {
          const kind = kinds[index] ?? 'waiting';
          return (
            <li
              key={player.id}
              aria-current={player.id === state.currentPlayerId ? 'true' : undefined}
              className={`${rowClass} ${ROW_HEIGHT[kind]} ${gapFor(kind)}`}
              style={{ transform: `translateY(${offsets[index]})` }}
            >
              {kind === 'current' && <CurrentCard player={player} state={state} layout={layout} />}
              {kind === 'waiting' && <WaitingRow player={player} state={state} layout={layout} next={player.id === nextId} />}
              {kind === 'placed' && <PlacedRow player={player} layout={layout} />}
            </li>
          );
        })}
        {Array.from({ length: freeSlots }, (_, slot) => (
          <li
            key={`slot-${slot}`}
            className={`${rowClass} ${ROW_HEIGHT.slot} ${gapFor('slot')}`}
            style={{ transform: `translateY(${offsets[players.length + slot]})` }}
          >
            <button
              type="button"
              disabled
              className="flex h-full w-full items-center justify-center gap-2 rounded-(--radius-card) border-2 border-dashed border-(--color-border) bg-(--color-surface-softer) font-display text-(length:--text-button) font-semibold text-(--color-text-muted)"
            >
              <PlusIcon />
              <span>
                <span>{pl.addPlayerSlot}</span> <span>{state.players.length + slot + 1}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

// Pełne nazwy klas, bo Tailwind generuje CSS tylko dla klas zapisanych dosłownie.
const ROW_HEIGHT: Record<ScoreboardRowKind, string> = {
  current: 'h-(--row-current)',
  waiting: 'h-(--row-waiting)',
  placed: 'h-(--row-placed)',
  slot: 'h-(--row-slot)',
};

function rowKind(state: MatchSnapshot, player: MatchSnapshotPlayer): ScoreboardRowKind {
  if (player.place !== null) {
    return 'placed';
  }
  return player.id === state.currentPlayerId ? 'current' : 'waiting';
}

// Następny po rzucającym wśród grających, po kolei z listy graczy i w kółko.
function nextPlayerId(state: MatchSnapshot): string | null {
  const active = state.players.filter((player) => player.place === null);
  const throwerIndex = active.findIndex((player) => player.id === state.currentPlayerId);
  if (state.finished || active.length < 2 || throwerIndex < 0) {
    return null;
  }
  return active[(throwerIndex + 1) % active.length]?.id ?? null;
}

// Pasek tylko przy wyniku startowym i pozostałym, czyli bez Free run, treningu końcówek i zakończonego gracza zabawy.
function progressOf(state: MatchSnapshot, player: MatchSnapshotPlayer): { startingScore: number; remaining: number } | null {
  if (state.startingScore === null || player.remaining === null || player.place !== null) {
    return null;
  }
  return { startingScore: state.startingScore, remaining: player.remaining };
}

function legDotsOf(state: MatchSnapshot, player: MatchSnapshotPlayer): { won: number; target: number } | null {
  if (state.type !== 'match' || player.legsWon === null || state.legsToWin === null) {
    return null;
  }
  return { won: player.legsWon, target: state.legsToWin };
}

interface RowProps {
  player: MatchSnapshotPlayer;
  state: MatchSnapshot;
  layout: Layout;
}

function CurrentCard({ player, state, layout }: RowProps) {
  const progress = progressOf(state, player);
  const legs = legDotsOf(state, player);
  const { throwingNow, throwingNowShort } = pl;
  return (
    <div
      className={`sc-player--currentrelative isolate grid h-full items-center overflow-hidden rounded-(--radius-card) text-(--color-text) ${classes(layout, 'currentCard')}`}
    >
      <CardRings className={`-z-10 ${classes(layout, 'currentRings')}`} />
      <span className="col-start-1 row-start-1">
        <Avatar name={player.name} avatar={player.avatar} color={player.color} size={layout.avatars.current} current />
      </span>
      <span className={`col-start-2 row-start-1 flex min-w-0 flex-col ${classes(layout, 'currentWho')}`}>
        <span className={`truncate font-display leading-none font-bold ${classes(layout, 'currentName')}`}>{player.name}</span>
        <span className={`truncate leading-tight text-(--color-text-sub) ${classes(layout, 'currentDesc')}`}>
          {state.checkouts ? throwingNowShort : throwingNow(state.currentDarts.length + 1)}
        </span>
      </span>
      {legs && <LegDots won={legs.won} target={legs.target} className="col-start-3 row-start-1 gap-1.5" dotClass={classes(layout, 'currentDots')} />}
      <div className={classes(layout, 'currentValue')}>
        {state.freeRun ? (
          <SessionCounter items={freeRunItems(state.freeRun)} layout={layout} />
        ) : state.checkouts ? (
          <SessionCounter items={checkoutItems(state.checkouts)} layout={layout} />
        ) : (
          <span className={`sc-player__value block font-display leading-[0.82] font-extrabold tabular-nums ${classes(layout, 'currentScore')}`}>{player.remaining}</span>
        )}
      </div>
      {progress && (
        <div className={`col-span-full ${classes(layout, 'bar')}`}>
          <ProgressBar startingScore={progress.startingScore} remaining={progress.remaining} current />
        </div>
      )}
    </div>
  );
}

function WaitingRow({ player, state, layout, next }: RowProps & { next: boolean }) {
  const progress = progressOf(state, player);
  const legs = legDotsOf(state, player);
  const rings = layout.lg?.waitingRings;
  return (
    <div
      className={`sc-player--waiting relative isolate grid h-full grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[minmax(0,1fr)_auto] items-center overflow-hidden rounded-(--radius-card) text-(--color-text) ${classes(layout, 'waitingCard')}`}
    >
      {rings && <CardRings className={`-z-10 ${rings}`} />}
      <Avatar name={player.name} avatar={player.avatar} color={player.color} size={layout.avatars.waiting} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className={`truncate font-display leading-none font-semibold ${classes(layout, 'waitingName')}`}>{player.name}</span>
          {legs && <LegDots won={legs.won} target={legs.target} className="gap-[5px]" dotClass={classes(layout, 'waitingDots')} />}
        </span>
        {next && <span className={`truncate leading-tight text-(--color-text-muted) ${classes(layout, 'waitingNext')}`}>{pl.nextInQueue}</span>}
      </span>
      {state.freeRun ? (
        <SessionCounter items={freeRunItems(state.freeRun)} layout={layout} />
      ) : state.checkouts ? (
        <SessionCounter items={checkoutItems(state.checkouts)} layout={layout} />
      ) : (
        <span className={`font-display font-bold tabular-nums text-(--color-text-sub) ${classes(layout, 'waitingScore')}`}>{player.remaining}</span>
      )}
      {progress && (
        <div className="col-span-full row-start-2">
          <ProgressBar startingScore={progress.startingScore} remaining={progress.remaining} current={false} />
        </div>
      )}
    </div>
  );
}

function PlacedRow({ player, layout }: { player: MatchSnapshotPlayer; layout: Layout }) {
  const place = player.place ?? 0;
  return (
    <div className={`sc-player--waiting flex h-full items-center overflow-hidden rounded-(--radius-card) text-(--color-text) ${classes(layout, 'placedCard')}`}>
      <Avatar name={player.name} avatar={player.avatar} color={player.color} size={layout.avatars.placed} />
      <span className={`min-w-0 flex-1 truncate font-display leading-none font-semibold ${classes(layout, 'placedName')}`}>{player.name}</span>
      <span className="flex shrink-0 items-center gap-2 rounded-(--radius-pill) bg-(--color-surface-soft) px-3.5 py-[7px] font-display text-[17px] leading-none font-bold whitespace-nowrap">
        <PlaceIcon className={place === 1 ? 'text-(--color-gold)' : 'text-(--color-text)'} />
        {pl.place(place)}
      </span>
    </div>
  );
}

function LegDots({ won, target, className, dotClass }: { won: number; target: number; className: string; dotClass: string }) {
  return (
    <span role="img" aria-label={pl.legsWonOf(won, target)} className={`flex shrink-0 ${className}`}>
      {Array.from({ length: target }, (_, index) => (
        <span
          key={index}
          className={`rounded-full border-2 ${dotClass} ${index < won ? 'border-(--color-text) bg-(--color-text)' : 'border-(--color-text-muted)'}`}
        />
      ))}
    </span>
  );
}

type CounterItems = readonly (readonly [term: string, value: string])[];

function freeRunItems(freeRun: NonNullable<MatchSnapshot['freeRun']>): CounterItems {
  return [
    [pl.total, String(freeRun.totalPoints)],
    [pl.dartsThrown, String(freeRun.dartsThrown)],
    [pl.average, formatDecimal(freeRun.average, 1)],
  ];
}

function checkoutItems(session: NonNullable<MatchSnapshot['checkouts']>): CounterItems {
  return [
    [pl.checkoutAttempts, String(session.attempts)],
    [pl.checkoutSuccesses, String(session.successes)],
    [pl.checkoutPercent, formatCheckoutPercent(session)],
  ];
}

// Licznik sesji w miejscu pozostałego wyniku, w treningach bez wyniku.
function SessionCounter({ items, layout }: { items: CounterItems; layout: Layout }) {
  return (
    <dl className={`flex shrink-0 font-display ${classes(layout, 'counter')}`}>
      {items.map(([term, value]) => (
        <div key={term} className="flex flex-col items-end">
          <dt className={`leading-tight uppercase tracking-(--tracking-label) text-(--color-text-muted) ${classes(layout, 'counterTerm')}`}>{term}</dt>
          <dd className={`leading-none font-bold tabular-nums ${classes(layout, 'counterValue')}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
