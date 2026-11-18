// Kolor numeru miejsca. Znaczenie niesie sam numer, kolor tylko je podkreśla.
export function placeColor(place: number): string {
  switch (place) {
    case 1:
      return 'text-(--color-gold)';
    case 2:
      return 'text-(--color-silver)';
    case 3:
      return 'text-(--color-bronze)';
    default:
      return 'text-(--color-text-muted)';
  }
}
