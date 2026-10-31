import type { ReactNode } from 'react';

// Ikony obok tekstu, żeby kolor nie niósł znaczenia sam. Dla czytników ekranu wystarcza tekst obok.
interface IconProps {
  className?: string | undefined;
}

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={`inline-block h-[1em] w-[1em] shrink-0 ${className ?? ''}`}>
      {children}
    </svg>
  );
}

export function ThrowingIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M8 4l12 8-12 8z" />
    </Svg>
  );
}

export function PauseIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
    </Svg>
  );
}

export function StopIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 6h12v12H6z" />
    </Svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 3v6.4l5.2 3.1 1-1.7-4.2-2.5V7z" />
    </Svg>
  );
}

export function BustIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6.4 4L12 9.6 17.6 4 20 6.4 14.4 12 20 17.6 17.6 20 12 14.4 6.4 20 4 17.6 9.6 12 4 6.4z" />
    </Svg>
  );
}

export function TrophyIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 3h12v2h3v3a5 5 0 01-5 5h-.3A6 6 0 0113 15.9V18h4v3H7v-3h4v-2.1A6 6 0 018.3 13H8a5 5 0 01-5-5V5h3zm0 4H5v1a3 3 0 001 2.2zm12 0v3.2A3 3 0 0019 8V7z" />
    </Svg>
  );
}

export function PlaceIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 2a6 6 0 016 6 6 6 0 01-3 5.2V22l-3-2-3 2v-8.8A6 6 0 016 8a6 6 0 016-6z" />
    </Svg>
  );
}

export function WarningIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 2l10 19H2zm-1 7v6h2V9zm0 8v2h2v-2z" />
    </Svg>
  );
}

export function SpeakerIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 9h4l5-5v16l-5-5H3zm11-1v8a4.5 4.5 0 000-8zm0-4.8v2.1a7 7 0 010 13.4v2.1a9 9 0 000-17.6z" />
    </Svg>
  );
}

export function SpeakerOffIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 9h4l5-5v16l-5-5H3zm13.76-.2L19 11.04l2.24-2.24.96.96L19.96 12l2.24 2.24-.96.96L19 12.96l-2.24 2.24-.96-.96L18.04 12 15.8 9.76z" />
    </Svg>
  );
}

export function EffectsIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </Svg>
  );
}

export function EffectsOffIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4.27 3L3 4.27l9 9v.28c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4v-1.73L19.73 21 21 19.73 4.27 3zM14 7h4V3h-6v5.18l2 2z" />
    </Svg>
  );
}

export function CommentIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 3h16a2 2 0 012 2v11a2 2 0 01-2 2H8l-4 4V5a2 2 0 012-2zm3 5v2h10V8zm0 4v2h7v-2z" />
    </Svg>
  );
}

export function CommentOffIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3.27 2L2 3.27l1.73 1.73A2 2 0 004 5v17l4-4h7.73l5 5L22 21.73zM20 3H7.83l13.92 13.92A2 2 0 0022 16V5a2 2 0 00-2-2z" />
    </Svg>
  );
}

export function TargetIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path fillRule="evenodd" d="M12 2a10 10 0 110 20 10 10 0 010-20zm0 2a8 8 0 100 16 8 8 0 000-16zm0 3a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6zm0 1.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
    </Svg>
  );
}

export function UndoIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M9 4L3 9.5 9 15v-4h5a4 4 0 010 8h-3v2h3a6 6 0 000-12H9z" />
    </Svg>
  );
}

export function ShuffleIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M14 4h6v6l-2.3-2.3L5.4 20 4 18.6 16.3 6.3zM4 5.4L5.4 4l5.2 5.2-1.4 1.4zM13.4 14.8l1.4-1.4 3 3L20 14v6h-6l2.4-2.4z" />
    </Svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7 10V7a5 5 0 0110 0v3h2v12H5V10zm2 0h6V7a3 3 0 00-6 0z" />
    </Svg>
  );
}

export function FlagIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 3h2v1h12l-3 5 3 5H7v7H5zm2 3v6h8.5l-1.8-3 1.8-3z" />
    </Svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z" />
    </Svg>
  );
}

export function ArchiveIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 3h18v5H3zm1 6h16v12H4zm5 3v2h6v-2z" />
    </Svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
    </Svg>
  );
}

export function PlayersIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M8 4.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7zm8 0a3.5 3.5 0 110 7 3.5 3.5 0 010-7zM1.5 21c.7-4 3.2-6.5 6.5-6.5s5.8 2.5 6.5 6.5zm8 0c.7-4 3.2-6.5 6.5-6.5s5.8 2.5 6.5 6.5z" />
    </Svg>
  );
}

export function StarIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 2.5l2.2 4.5 5 .7-3.6 3.6.8 5-4.4-2.2-4.4 2.2.8-5-3.6-3.6 5-.7zM5 20h14v2H5z" />
    </Svg>
  );
}

export function RingIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 2.5a2 2 0 110 4 2 2 0 010-4zm0 15a2 2 0 110 4 2 2 0 010-4zM4.5 10a2 2 0 110 4 2 2 0 010-4zm15 0a2 2 0 110 4 2 2 0 010-4zM6.7 4.7a2 2 0 110 4 2 2 0 010-4zm10.6 0a2 2 0 110 4 2 2 0 010-4zM6.7 15.3a2 2 0 110 4 2 2 0 010-4zm10.6 0a2 2 0 110 4 2 2 0 010-4z" />
    </Svg>
  );
}

export function GridIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 3h5v5H3zm6.5 0h5v5h-5zM16 3h5v5h-5zM3 9.5h5v5H3zm6.5 0h5v5h-5zm6.5 0h5v5h-5zM3 16h5v5H3zm6.5 0h5v5h-5zm6.5 0h5v5h-5z" />
    </Svg>
  );
}

export function ArrowUpIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3l8 8h-5.5v10h-5V11H4z" />
    </Svg>
  );
}

export function ArrowDownIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 21l-8-8h5.5V3h5v10H20z" />
    </Svg>
  );
}
