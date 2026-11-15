// Rodzic potrzebuje relative overflow-hidden, a treść obok tarczy relative, żeby leżała nad nią.
export function CornerRings({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      focusable="false"
      className={`pointer-events-none absolute fill-none stroke-(--color-text) opacity-(--opacity-card-rings) ${className ?? ''}`}
    >
      <circle cx="100" cy="100" r="95" strokeWidth={10} />
      <circle cx="100" cy="100" r="58" strokeWidth={10} />
      <circle cx="100" cy="100" r="22" className="fill-(--color-text) stroke-none" />
    </svg>
  );
}
