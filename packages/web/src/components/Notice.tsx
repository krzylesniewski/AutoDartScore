import { WarningIcon } from './icons';

// Komunikat o błędzie: ikona i tekst, nie sam kolor. Akcent zostaje na ikonie, bo jako tekst na karcie ma za mały kontrast.
export function Notice({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 font-display text-lg text-(--color-text)">
      <WarningIcon className="text-(--color-accent)" />
      {text}
    </p>
  );
}
