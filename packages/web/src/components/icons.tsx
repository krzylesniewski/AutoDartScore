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
