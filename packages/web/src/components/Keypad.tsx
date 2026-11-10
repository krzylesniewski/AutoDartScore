import { BULL_SEGMENT, MISS_SEGMENT, type FrequentHit, type Hit } from '@autoscore/schema';
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DARTBOARD_ORDER } from '../game/dartboard-order';
import { frequentHitLabel } from '../game/frequent-hit-label';
import { readKeypadLayout, type KeypadLayout } from '../game/keypad-layout';
import { MIN_KEY_PX, RING_CENTER_HEIGHT_PERCENT, RING_CENTER_WIDTH_PERCENT, RING_KEY_PERCENT, ringKeyPosition } from '../game/keypad-ring';
import { pl } from '../i18n/pl';
import { KeypadKey, type KeypadKeyHandle, type KeypadKeyTone } from './KeypadKey';
import { UndoButton } from './UndoButton';
import { useKeypadShortcuts } from './use-keypad-shortcuts';

type Multiplier = 1 | 2 | 3;

const MULTIPLIERS: readonly { value: Multiplier; label: string; longLabel: string }[] = [
  { value: 1, label: pl.multiplierSingle, longLabel: pl.multiplierSingleLong },
  { value: 2, label: pl.multiplierDouble, longLabel: pl.multiplierDoubleLong },
  { value: 3, label: pl.multiplierTreble, longLabel: pl.multiplierTrebleLong },
];

const OUTER_BULL_SHORTCUT = { keys: 'B', label: pl.shortcutB };
const BULL_SHORTCUT = { keys: 'Shift+B', label: pl.shortcutShiftB };
const MISS_SHORTCUT = { keys: 'Space', label: pl.shortcutSpace };

// Ramka 2 px zostaje także w spoczynku, przezroczysta, żeby błysk akcentu nie przesuwał treści klawisza.
const keyBase = 'border-(length:--border-width) font-display disabled:opacity-40';
const restBorder = 'border-transparent';
// Gradient siedzi w tonie, bo utility tła wygrywa z klasą komponentu. Każdy stan ma wtedy dokładnie jedną klasę bg-*.
const segmentFill = 'bg-linear-to-b from-(--color-surface-raised) to-(--color-surface) text-(--color-text)';
const segmentTone: KeypadKeyTone = { fill: segmentFill, border: restBorder };
// Jaśniejsza ramka pokazuje górę koła.
const topSegmentTone: KeypadKeyTone = { fill: segmentFill, border: 'border-(--color-text-muted)' };
const segmentClass = `font-bold shadow-(--shadow-key) ${keyBase}`;
// Bull ma obwódkę akcentu w cieniu z .sc-key--bull, więc nie może dostać utility shadow-*.
const bullClass = `sc-key--bull font-bold ${keyBase}`;
const missTone: KeypadKeyTone = { fill: 'bg-(--color-surface-soft) text-(--color-text)', border: restBorder };
const missClass = `rounded-(--radius-card) text-[30px] leading-none font-extrabold shadow-(--shadow-inset-line) lg:text-4xl ${keyBase}`;
const restMissTone: KeypadKeyTone = { fill: 'bg-transparent text-(--color-text-sub)', border: restBorder };
const restMissClass = `rounded-(--radius-button) px-1 text-lg leading-none font-semibold shadow-(--shadow-outline) lg:text-[19px] ${keyBase}`;
const multiplierTone: KeypadKeyTone = { fill: 'bg-transparent text-(--color-text)', border: restBorder };
const selectedMultiplierTone: KeypadKeyTone = { fill: 'bg-(--color-text) text-(--color-text-inverse) shadow-(--shadow-selected)', border: 'border-(--color-text)' };
const multiplierClass = `rounded-(--radius-segment) text-2xl font-bold lg:text-[22px] ${keyBase}`;
const multiplierTray = 'gap-1.5 rounded-(--radius-card) bg-(--color-surface-soft) p-1.5';
const frequentTone: KeypadKeyTone = { fill: 'bg-(--color-surface-soft) text-(--color-text)', border: restBorder };

// Bok koła od lg: wysokość okna minus wszystko nad klawiaturą i pod nią (--keypad-ring-reserve w theme.css),
// ale nie więcej niż szerokość sekcji minus kolumna Najczęstszych (160 px), mnożnik (96 px) i dwa odstępy (24 px).
// Przy kole mniejszym niż około 327 px sąsiednie okrągłe klawisze 44 px nachodziłyby na siebie, stąd dolna granica 330 px.
const ringSide =
  'aspect-square w-full max-w-[400px] mx-auto lg:mx-0 lg:w-[clamp(330px,min(100dvh_-_var(--keypad-ring-reserve),100cqi_-_280px),600px)] lg:max-w-none';
const ringKeySize = `max(${MIN_KEY_PX}px, ${RING_KEY_PERCENT}cqi)`;
const ringText = 'text-[clamp(20px,6.5cqi,32px)] leading-none';
// Blok najczęstszych trafień ma stałą wysokość także bez listy, żeby klawiatura nie skakała przy ładowaniu i zmianie gracza.
// Mniejszy tekst niż na klawiszach liczb, żeby Bull mieścił się w klawiszu 44 px.
const frequentLabel = 'h-5 truncate font-display text-base leading-5 text-(--color-text-muted)';
const frequentKey = `sc-chip min-h-11 min-w-11 px-0 text-lg leading-none ${keyBase}`;

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
  undo(className: string): ReactNode;
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
        {MULTIPLIERS.map(({ value, label, longLabel }) => (
          <KeypadKey
            key={value}
            ref={handleIn(multiplierKeys.current, value)}
            ariaPressed={multiplier === value}
            disabled={disabled}
            onPress={() => selectMultiplier(value)}
            className={`${keyClassName} ${multiplierClass}`}
            idleTone={multiplier === value ? selectedMultiplierTone : multiplierTone}
            // Ciemne tło wciśnięcia na kremowym klawiszu wyglądałoby jak odznaczenie, więc wybrany klawisz tylko schodzi o 1 px.
            pressedTone={multiplier === value ? selectedMultiplierTone : undefined}
            shortcut={{ keys: label, label }}
          >
            {/* Od lg pełne słowo, ale nazwa dostępna zostaje literą, tak jak skrót. */}
            <span className="lg:sr-only">{label}</span>
            <span aria-hidden="true" className="hidden lg:inline">
              {longLabel}
            </span>
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
        className={`${className} ${segmentClass}`}
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
        className={`${className} ${segmentClass}`}
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
        className={`${className} ${bullClass}`}
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
        className={`${className} ${missClass}`}
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
        className={`${className} ${restMissClass}`}
        idleTone={restMissTone}
      >
        {pl.restMiss}
      </KeypadKey>
    ),
    undo: (className) => <UndoButton onUndo={onUndo} disabled={undoDisabled} className={className} />,
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
                idleTone={frequentTone}
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

// Poniżej lg: S/D/T nad kołem, Miss, Reszta Miss i Cofnij pod nim. Od lg trzy kolumny o wysokości koła.
// Najczęstsze trafienia są tylko od lg, nad Miss. Etykieta i dwa rzędy po trzy klawisze 44 px mieszczą się w 160 px.
// Kolumna obok koła: 124 px Najczęstszych, Miss, Reszta Miss i Cofnij po 56 px i trzy odstępy 12 px mieszczą się w 330 px.
function RingKeypad({ keys }: { keys: Keys }) {
  const centreKey = `min-w-0 flex-1 rounded-(--radius-pill) ${ringText}`;
  const centreHeight = { height: `max(${MIN_KEY_PX}px, ${RING_CENTER_HEIGHT_PERCENT}cqi)` };

  return (
    <section aria-label={pl.keypad} className="@container flex flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(160px,1fr)] lg:gap-3">
      {keys.multipliers(`grid h-14 grid-cols-3 ${multiplierTray} lg:h-auto lg:w-full lg:max-w-40 lg:grid-cols-1 lg:grid-rows-3 lg:justify-self-end`, 'lg:min-h-14')}
      <div className={`@container relative ${ringSide}`}>
        {DARTBOARD_ORDER.map((segment, index) => {
          const { left, top } = ringKeyPosition(index);
          return keys.segment(segment, `absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${ringText}`, {
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
      <div className="grid grid-cols-[3fr_2fr_2fr] gap-2 lg:flex lg:flex-col lg:gap-3">
        {keys.frequent('hidden h-31 shrink-0 flex-col gap-2 lg:flex', 'grid flex-1 grid-cols-3 grid-rows-2 gap-2')}
        {keys.miss('h-14 lg:h-auto lg:min-h-14 lg:flex-1')}
        {keys.restMiss('h-14 shrink-0')}
        {keys.undo('h-14 shrink-0')}
      </div>
    </section>
  );
}

// 1-20 w kolejności z tarczy: 5 kolumn poniżej lg, 10 od lg.
const gridKey = 'rounded-(--radius-button) text-(length:--text-heading)';

function GridKeypad({ keys }: { keys: Keys }) {
  return (
    <section aria-label={pl.keypad} className="flex flex-col gap-2">
      {keys.multipliers(`grid h-14 grid-cols-3 ${multiplierTray} lg:h-[62px]`, '')}
      {keys.frequent('flex h-18 shrink-0 flex-col gap-2', 'grid flex-1 grid-cols-6 gap-2')}
      <div className="grid grid-cols-5 gap-2 lg:grid-cols-10">{DARTBOARD_ORDER.map((segment) => keys.segment(segment, `h-14 lg:h-[78px] ${gridKey}`))}</div>
      <div className="grid grid-cols-6 gap-2 lg:grid-cols-10">
        {keys.outerBull(`col-span-3 h-14 lg:col-span-2 lg:h-[62px] ${gridKey}`)}
        {keys.bull(`col-span-3 h-14 lg:col-span-2 lg:h-[62px] ${gridKey}`)}
        {keys.miss('col-span-2 h-14 lg:h-[62px]')}
        {keys.restMiss('col-span-2 h-14 lg:h-[62px]')}
        {keys.undo('col-span-2 h-14 lg:h-[62px]')}
      </div>
    </section>
  );
}
