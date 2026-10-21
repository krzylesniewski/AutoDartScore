import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';

export const HIT_FLASH_MS = 200;

const PRESSED_TONE: KeypadKeyTone = { fill: 'bg-(--color-surface-active) text-(--color-text)', border: 'border-(--color-text)' };
const FLASH_BORDER = 'border-(--color-accent)';
const feedback = 'touch-manipulation transition-[background-color,border-color,scale] duration-80';

export interface KeypadKeyTone {
  // Klasy tła i tekstu. Kolor ramki jest osobno, bo błysk podmienia tylko ramkę.
  fill: string;
  border: string;
}

export interface KeypadKeyProps {
  children: ReactNode;
  disabled: boolean;
  onPress(): void;
  flashOnPress?: boolean;
  ariaPressed?: boolean;
  className: string;
  style?: CSSProperties | undefined;
  idleTone: KeypadKeyTone;
  pressedTone?: KeypadKeyTone | undefined;
}

export function KeypadKey({
  children,
  disabled,
  onPress,
  flashOnPress = false,
  ariaPressed,
  className,
  style,
  idleTone,
  pressedTone = PRESSED_TONE,
}: KeypadKeyProps) {
  const [pressed, setPressed] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Zablokowany klawisz gubi stan, żeby po odblokowaniu nie wrócił sam.
  if (disabled && (pressed || flashing)) {
    setPressed(false);
    setFlashing(false);
  }

  // Zablokowanie w trakcie błysku kasuje też jego zegar.
  useEffect(() => {
    if (disabled) {
      clearTimeout(flashTimer.current);
    }
  }, [disabled]);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  // Safari na iOS nie pokazuje :active bez obsługi dotyku, a krótkie stuknięcie i tak go nie pokaże. Dlatego zdarzenia wskaźnika.
  function handlePointerDown(event: PointerEvent<HTMLButtonElement>): void {
    if (disabled || event.button !== 0) {
      return;
    }

    setPressed(true);
  }

  function release(): void {
    setPressed(false);
  }

  // Błysk startuje z kliknięcia, więc widać go też po bardzo krótkim stuknięciu i po Enter lub spacji.
  function handleClick(): void {
    onPress();
    if (!flashOnPress) {
      return;
    }

    clearTimeout(flashTimer.current);
    setFlashing(true);
    flashTimer.current = setTimeout(() => setFlashing(false), HIT_FLASH_MS);
  }

  const tone = pressed ? pressedTone : idleTone;
  const border = flashing ? FLASH_BORDER : tone.border;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={ariaPressed}
      data-pressed={pressed ? '' : undefined}
      data-flash={flashing ? '' : undefined}
      onPointerDown={handlePointerDown}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onClick={handleClick}
      style={style}
      className={`${className} ${feedback} ${tone.fill} ${border}${pressed ? ' motion-safe:scale-96' : ''}`}
    >
      {children}
    </button>
  );
}
