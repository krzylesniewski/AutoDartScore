import { BULL_SEGMENT, MISS_SEGMENT, type FrequentHit, type Hit } from '@autoscore/schema';
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DARTBOARD_ORDER } from '../game/dartboard-order';
import { frequentHitLabel } from '../game/frequent-hit-label';
import { readKeypadLayout, type KeypadLayout } from '../game/keypad-layout';
import { MIN_KEY_PX, RING_CENTER_HEIGHT_PERCENT, RING_CENTER_WIDTH_PERCENT, RING_KEY_PERCENT, ringKeyPosition } from '../game/keypad-ring';
import { pl } from '../i18n/pl';
import { KeypadKey, type KeypadKeyHandle, type KeypadKeyTone } from './KeypadKey';
import { useKeypadShortcuts } from './use-keypad-shortcuts';

type Multiplier = 1 | 2 | 3;

const MULTIPLIERS: readonly { value: Multiplier; label: string }[] = [
  { value: 1, label: pl.multiplierSingle },
  { value: 2, label: pl.multiplierDouble },
  { value: 3, label: pl.multiplierTreble },
];

const OUTER_BULL_SHORTCUT = { keys: 'B', label: pl.shortcutB };
const BULL_SHORTCUT = { keys: 'Shift+B', label: pl.shortcutShiftB };
const MISS_SHORTCUT = { keys: 'Space', label: pl.shortcutSpace };

const keyBase = 'border-(length:--border-width) font-display font-bold disabled:opacity-40';
const key = `rounded-(--radius-card) text-(length:--text-heading) ${keyBase}`;
const idleBorder = 'border-(--color-border-strong)';
const segmentFill = 'bg-(--color-surface-button) text-(--color-text)';
const segmentTone: KeypadKeyTone = { fill: segmentFill, border: idleBorder };
// Jaśniejsza ramka pokazuje górę koła.
const topSegmentTone: KeypadKeyTone = { fill: segmentFill, border: 'border-(--color-text-muted)' };
const missTone: KeypadKeyTone = { fill: 'bg-(--color-surface) text-(--color-text-muted)', border: idleBorder };
const multiplierTone: KeypadKeyTone = { fill: 'bg-(--color-surface-button) text-(--color-text-muted)', border: idleBorder };
const selectedMultiplierTone: KeypadKeyTone = { fill: 'bg-(--color-text) text-(--color-text-inverse)', border: 'border-(--color-text)' };
const restMissText = 'text-lg leading-none';

// Bok koła od lg: wysokość okna minus wszystko nad klawiaturą i pod nią (--keypad-ring-reserve w theme.css).
// Przy kole mniejszym niż około 327 px sąsiednie okrągłe klawisze 44 px nachodziłyby na siebie, stąd dolna granica 330 px.
const ringSide = 'aspect-square w-full max-w-[400px] mx-auto lg:mx-0 lg:w-[clamp(330px,100dvh_-_var(--keypad-ring-reserve),450px)] lg:max-w-none';
const ringKeySize = `max(${MIN_KEY_PX}px, ${RING_KEY_PERCENT}cqi)`;
const ringText = 'text-[clamp(20px,6.5cqi,30px)] leading-none';
// Blok najczęstszych trafień ma stałą wysokość także bez listy, żeby klawiatura nie skakała przy ładowaniu i zmianie gracza.
// Mniejszy tekst niż na klawiszach liczb, żeby Bull mieścił się w klawiszu 44 px.
const frequentLabel = 'h-5 truncate font-display text-base leading-5 text-(--color-text-muted)';
const frequentKey = `min-h-11 min-w-11 rounded-(--radius-card) px-0 text-lg leading-none ${keyBase}`;

export interface KeypadProps {
  onHit(hit: Hit): void;
  onRestMiss(): void;
  onUndo(): void;
  disabled: boolean;
  undoDisabled: boolean;
  // Pierwsza rzutka podpowiedzi zamknięcia dla Enter albo null, gdy nie ma czego wpisać.
  checkout: Hit | null;
  frequent?: FrequentHits | null;
}

export interface FrequentHits {
  playerName: string;
  hits: readonly FrequentHit[];
}

// Wspólne klawisze obu układów. Układ podaje tylko klasy rozmiaru i położenia.
interface Keys {
  multipliers(groupClassName: string, keyClassName: string): ReactNode;
  segment(segment: number, className: string, style?: CSSProperties): ReactNode;
  outerBull(className: string, style?: CSSProperties): ReactNode;
  bull(className: string, style?: CSSProperties): ReactNode;
  miss(className: string): ReactNode;
  restMiss(className: string): ReactNode;
  frequent(blockClassName: string, keysClassName: string): ReactNode;
}

export function Keypad({ onHit, onRestMiss, onUndo, disabled, undoDisabled, checkout, frequent = null }: KeypadProps) {
  const [multiplier, setMultiplier] = useState<Multiplier>(1);
  // Kopia w refie, bo skrót może w jednym zdarzeniu wpisać dwie liczby (2 i 5), a druga ma już widzieć S po pierwszej.
  const currentMultiplier = useRef<Multiplier>(1);
  // Układ wybiera się na ekranie „Ustawienia”, który nigdy nie stoi obok klawiatury, więc wystarcza odczyt przy montowaniu.
  const [layout] = useState<KeypadLayout>(readKeypadLayout);
  const segmentKeys = useRef(new Map<number, KeypadKeyHandle>());
  const multiplierKeys = useRef(new Map<Multiplier, KeypadKeyHandle>());
  const outerBullKey = useRef<KeypadKeyHandle>(null);
  const bullKey = useRef<KeypadKeyHandle>(null);
  const missKey = useRef<KeypadKeyHandle>(null);

  function selectMultiplier(value: Multiplier): void {
    currentMultiplier.current = value;
    setMultiplier(value);
  }

  function hit(segment: number, value: Hit['multiplier']): void {
    onHit({ segment, multiplier: value });
    selectMultiplier(1);
  }

  function restMiss(): void {
    onRestMiss();
    selectMultiplier(1);
  }

  function enterCheckout(): void {
    if (!checkout) {
      return;
    }
    onHit(checkout);
    selectMultiplier(1);
  }

  useKeypadShortcuts({
    enabled: !disabled,
    undoEnabled: !undoDisabled,
    onMiss: () => missKey.current?.press(),
    onMultiplier: (value) => multiplierKeys.current.get(value)?.press(),
    onNumber: (segment) => segmentKeys.current.get(segment)?.press(),
    onOuterBull: () => outerBullKey.current?.press(),
    onBull: () => bullKey.current?.press(),
    onUndo,
    onEnterCheckout: enterCheckout,
  });

  const keys: Keys = {
    multipliers: (groupClassName, keyClassName) => (
      <div role="group" aria-label={pl.multiplier} className={groupClassName}>
        {MULTIPLIERS.map(({ value, label }) => (
          <KeypadKey
            key={value}
            ref={handleIn(multiplierKeys.current, value)}
            ariaPressed={multiplier === value}
            disabled={disabled}
            onPress={() => selectMultiplier(value)}
            className={`${keyClassName} ${key}`}
            idleTone={multiplier === value ? selectedMultiplierTone : multiplierTone}
            // Ciemne tło wciśnięcia na kremowym klawiszu wyglądałoby jak odznaczenie, więc wybrany klawisz tylko się zmniejsza.
            pressedTone={multiplier === value ? selectedMultiplierTone : undefined}
            shortcut={{ keys: label, label }}
          >
            {label}
          </KeypadKey>
        ))}
      </div>
    ),
    segment: (segment, className, style) => (
      <KeypadKey
        key={segment}
        ref={handleIn(segmentKeys.current, segment)}
        disabled={disabled}
        flashOnPress
        onPress={() => hit(segment, currentMultiplier.current)}
        className={className}
        style={style}
        idleTone={layout === 'ring' && segment === DARTBOARD_ORDER[0] ? topSegmentTone : segmentTone}
      >
        {segment}
      </KeypadKey>
    ),
    outerBull: (className, style) => (
      <KeypadKey
        ref={outerBullKey}
        disabled={disabled}
        flashOnPress
        onPress={() => hit(BULL_SEGMENT, 1)}
        className={className}
        style={style}
        idleTone={segmentTone}
        shortcut={OUTER_BULL_SHORTCUT}
      >
        {BULL_SEGMENT}
      </KeypadKey>
    ),
    bull: (className, style) => (
      <KeypadKey
        ref={bullKey}
        disabled={disabled}
        flashOnPress
        onPress={() => hit(BULL_SEGMENT, 2)}
        className={className}
        style={style}
        idleTone={segmentTone}
        shortcut={BULL_SHORTCUT}
      >
        {pl.bull}
      </KeypadKey>
    ),
    miss: (className) => (
      <KeypadKey
        ref={missKey}
        disabled={disabled}
        flashOnPress
        onPress={() => hit(MISS_SEGMENT, 0)}
        className={`${className} ${key}`}
        idleTone={missTone}
        shortcut={MISS_SHORTCUT}
      >
        {pl.miss}
      </KeypadKey>
    ),
    restMiss: (className) => (
      <KeypadKey
        disabled={disabled}
        flashOnPress
        onPress={restMiss}
        className={`${className} rounded-(--radius-card) px-1 ${restMissText} ${keyBase}`}
        idleTone={missTone}
      >
        {pl.restMiss}
      </KeypadKey>
    ),
    // Klawisz wysyła swoje trafienie bez względu na przełącznik S/D/T.
    frequent: (blockClassName, keysClassName) =>
      frequent && frequent.hits.length > 0 ? (
        <div role="group" aria-label={pl.frequentHits(frequent.playerName)} className={blockClassName}>
          <p aria-hidden="true" className={frequentLabel}>
            {pl.frequentHits(frequent.playerName)}
          </p>
          <div className={keysClassName}>
            {frequent.hits.map((frequentHit) => (
              <KeypadKey
                key={`${frequentHit.segment}:${frequentHit.multiplier}`}
                disabled={disabled}
                flashOnPress
                onPress={() => hit(frequentHit.segment, frequentHit.multiplier)}
                className={frequentKey}
                idleTone={segmentTone}
              >
                {frequentHitLabel(frequentHit)}
              </KeypadKey>
            ))}
          </div>
        </div>
      ) : (
        <div aria-hidden="true" className={blockClassName} />
      ),
  };

  return layout === 'ring' ? <RingKeypad keys={keys} /> : <GridKeypad keys={keys} />;
}

function handleIn<K>(handles: Map<K, KeypadKeyHandle>, id: K): (handle: KeypadKeyHandle | null) => void {
  return (handle) => {
    if (handle) {
      handles.set(id, handle);
    } else {
      handles.delete(id);
    }
  };
}

// Poniżej lg: S/D/T nad kołem, Miss pod nim. Od lg trzy kolumny o wysokości koła.
// Najczęstsze trafienia są tylko od lg, nad Miss. Etykieta i dwa rzędy po trzy klawisze 44 px mieszczą się w 160 px.
function RingKeypad({ keys }: { keys: Keys }) {
  const centreKey = `min-w-0 flex-1 rounded-(--radius-card) ${ringText} ${keyBase}`;
  const centreHeight = { height: `max(${MIN_KEY_PX}px, ${RING_CENTER_HEIGHT_PERCENT}cqi)` };

  return (
    <section aria-label={pl.keypad} className="flex flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(160px,1fr)] lg:gap-3">
      {keys.multipliers('grid h-13 grid-cols-3 gap-2 lg:h-auto lg:grid-cols-1 lg:grid-rows-3', 'lg:min-h-14')}
      <div className={`@container relative ${ringSide}`}>
        {DARTBOARD_ORDER.map((segment, index) => {
          const { left, top } = ringKeyPosition(index);
          return keys.segment(segment, `absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${ringText} ${keyBase}`, {
            left: `${left}%`,
            top: `${top}%`,
            width: ringKeySize,
            height: ringKeySize,
          });
        })}
        <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-2" style={{ width: `${RING_CENTER_WIDTH_PERCENT}%` }}>
          {keys.outerBull(centreKey, centreHeight)}
          {keys.bull(centreKey, centreHeight)}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 lg:flex lg:flex-col lg:gap-3">
        {keys.frequent('hidden h-31 shrink-0 flex-col gap-2 lg:flex', 'grid flex-1 grid-cols-3 grid-rows-2 gap-2')}
        {keys.miss('col-span-3 h-14 lg:h-auto lg:flex-1')}
        {keys.restMiss('h-14')}
      </div>
    </section>
  );
}

// 1-20 w kolejności z tarczy: 5 kolumn poniżej lg, 10 od lg.
function GridKeypad({ keys }: { keys: Keys }) {
  return (
    <section aria-label={pl.keypad} className="flex flex-col gap-2">
      {keys.multipliers('grid h-13 grid-cols-3 gap-2 lg:h-[58px]', '')}
      {keys.frequent('flex h-18 shrink-0 flex-col gap-2', 'grid flex-1 grid-cols-6 gap-2')}
      <div className="grid grid-cols-5 gap-2 lg:grid-cols-10">{DARTBOARD_ORDER.map((segment) => keys.segment(segment, `h-14 lg:h-[78px] ${key}`))}</div>
      <div className="grid grid-cols-4 gap-2 lg:grid-cols-10">
        {keys.outerBull(`col-span-2 h-14 lg:h-[62px] ${key}`)}
        {keys.bull(`col-span-2 h-14 lg:h-[62px] ${key}`)}
        {keys.miss('col-span-3 h-14 lg:col-span-4 lg:h-[62px]')}
        {keys.restMiss('col-span-1 h-14 lg:col-span-2 lg:h-[62px]')}
      </div>
    </section>
  );
}
