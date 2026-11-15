// Znak z design/scena/assets/Logo/autoscore-mark.svg. Kolory z tokenów zamiast wpisanych w plik.
export function AppMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 34" aria-hidden="true" focusable="false" className={`shrink-0 ${className ?? ''}`}>
      <circle cx="17" cy="17" r="15" className="fill-(--color-accent)" />
      <circle cx="17" cy="17" r="10" className="fill-(--color-bg)" />
      <circle cx="17" cy="17" r="6" className="fill-(--color-text)" />
      <circle cx="17" cy="17" r="2.4" className="fill-(--color-accent)" />
    </svg>
  );
}
