// Zbita część wyniku startowego w procentach, 0-100. Bez wyniku startowego albo pozostałego paska nie ma.
export function progressWidth(startingScore: number | null, remaining: number | null): number | null {
  if (startingScore === null || remaining === null) {
    return null;
  }
  const knocked = ((startingScore - remaining) / startingScore) * 100;
  return Math.min(100, Math.max(0, knocked));
}
