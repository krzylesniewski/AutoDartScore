import { WarningIcon } from './icons';

// Komunikat o błędzie: ikona i tekst, nie sam kolor.
export function Notice({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 font-display text-lg text-(--color-accent)">
      <WarningIcon />
      {text}
    </p>
  );
}
