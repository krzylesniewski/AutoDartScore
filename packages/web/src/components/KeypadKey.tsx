import { useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type Ref } from 'react';

export const HIT_FLASH_MS = 200;

const PRESSED_TONE: KeypadKeyTone = { fill: 'bg-(--color-surface-active) text-(--color-text)', border: 'border-(--color-text)' };
const FLASH_BORDER = 'border-(--color-accent)';
const feedback = 'touch-manipulation transition-[background-color,border-color,scale] duration-80';
// Kolor tekstu klawisza z mniejszą kryjącością, więc odznaka jest czytelna także na kremowym wybranym mnożniku.
export const SHORTCUT_BADGE = 'pointer-events-none absolute top-1 right-1.5 hidden font-body text-xs leading-none font-medium opacity-70 lg:block';

export interface KeypadKeyTone {
  // Klasy tła i tekstu. Kolor ramki jest osobno, bo błysk podmienia tylko ramkę.
  fill: string;
  border: string;
}

export interface KeypadKeyHandle {
  press(): void;
}

export interface KeypadKeyShortcut {
  // Wartość aria-keyshortcuts, np. Shift+B.
  keys: string;
  label: string;
}

export interface KeypadKeyProps {
  ref?: Ref<KeypadKeyHandle> | undefined;
  children: ReactNode;
  disabled: boolean;
  // W odróżnieniu od disabled nie kasuje trwającego błysku, bo kliknięcie, które wysyła komendę, od razu ustawia ten stan.
  ignorePress?: boolean;
  onPress(): void;
  flashOnPress?: boolean;
  ariaPressed?: boolean;
  className: string;
  style?: CSSProperties | undefined;
  idleTone: KeypadKeyTone;
  pressedTone?: KeypadKeyTone | undefined;
  shortcut?: KeypadKeyShortcut | undefined;
  title?: string | undefined;
  flashBorder?: string;
}

export function KeypadKey({
  ref,
  children,
  disabled,
  ignorePress = false,
  onPress,
  flashOnPress = false,
  ariaPressed,
  className,
  style,
  idleTone,
  pressedTone = PRESSED_TONE,
  shortcut,
  title,
  flashBorder = FLASH_BORDER,
}: KeypadKeyProps) {
  const [pressed, setPressed] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Zablokowany klawisz gubi stan, żeby po odblokowaniu nie wrócił sam.
  if (disabled && (pressed || flashing)) {
    setPressed(false);
    setFlashing(false);
  }

  // Zablokowanie w trakcie błysku albo wciśnięcia ze skrótu kasuje też ich zegary.
  useEffect(() => {
    if (disabled) {
      clearTimeout(flashTimer.current);
      clearTimeout(pressTimer.current);
    }
  }, [disabled]);

  useEffect(
    () => () => {
      clearTimeout(flashTimer.current);
      clearTimeout(pressTimer.current);
    },
    [],
  );

  // Safari na iOS nie pokazuje :active bez obsługi dotyku, a krótkie stuknięcie i tak go nie pokaże. Dlatego zdarzenia wskaźnika.
  function handlePointerDown(event: PointerEvent<HTMLButtonElement>): void {
    if (disabled || ignorePress || event.button !== 0) {
      return;
    }

    setPressed(true);
  }

  function release(): void {
    setPressed(false);
  }

  // Błysk startuje z kliknięcia, więc widać go też po bardzo krótkim stuknięciu i po skrócie z klawiatury.
  function handleClick(): void {
    if (ignorePress) {
      return;
    }

    onPress();
    if (!flashOnPress) {
      return;
    }

    clearTimeout(flashTimer.current);
    setFlashing(true);
    flashTimer.current = setTimeout(() => setFlashing(false), HIT_FLASH_MS);
  }

  // Bez listy zależności uchwyt powstaje przy każdym renderze, więc skrót zawsze woła aktualne onPress.
  useImperativeHandle(ref, () => ({
    press() {
      if (disabled || ignorePress) {
        return;
      }
      handleClick();
      // Klawisz fizyczny nie daje zdarzeń wskaźnika, więc wciśnięcie trwa tyle co błysk.
      clearTimeout(pressTimer.current);
      setPressed(true);
      pressTimer.current = setTimeout(() => setPressed(false), HIT_FLASH_MS);
    },
  }));

  const tone = pressed ? pressedTone : idleTone;
  const border = flashing ? flashBorder : tone.border;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={ariaPressed}
      aria-keyshortcuts={shortcut?.keys}
      title={title}
      data-pressed={pressed ? '' : undefined}
      data-flash={flashing ? '' : undefined}
      onPointerDown={handlePointerDown}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onClick={handleClick}
      style={style}
      // Klawisze koła 1-20 są absolute, więc relative dostaje tylko klawisz z odznaką.
      className={`${className} ${feedback} ${tone.fill} ${border}${pressed ? ' motion-safe:scale-96' : ''}${shortcut ? ' relative' : ''}`}
    >
      {children}
      {shortcut && (
        <span aria-hidden="true" className={SHORTCUT_BADGE}>
          {shortcut.label}
        </span>
      )}
    </button>
  );
}
