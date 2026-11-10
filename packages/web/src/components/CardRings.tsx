// Mała tarcza w rogu karty. Rozmiar i położenie daje className.
export function CardRings({ className }: { className: string }) {
  return (
    <svg className={`sc-card-rings ${className}`} aria-hidden="true" focusable="false" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="95" fill="none" stroke="currentColor" strokeWidth={8} />
      <circle cx="100" cy="100" r="58" fill="none" stroke="currentColor" strokeWidth={8} />
      <circle cx="100" cy="100" r="22" fill="currentColor" />
    </svg>
  );
}
