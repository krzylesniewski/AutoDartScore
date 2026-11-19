export interface AbbreviationProps {
  short: string;
  full: string;
}

// Skrót na ekranie, pełny tekst dla czytników ekranu.
export function Abbreviation({ short, full }: AbbreviationProps) {
  return (
    <>
      <span aria-hidden="true">{short}</span>
      <span className="sr-only">{full}</span>
    </>
  );
}
