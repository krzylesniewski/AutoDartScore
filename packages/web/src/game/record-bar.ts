function ratio(value: number, best: number, lowerIsBetter: boolean): number {
  if (lowerIsBetter) {
    return value > 0 ? best / value : 0;
  }
  return best > 0 ? value / best : 0;
}

// Długość paska rekordu w procentach rekordu lidera. Serwer sortuje wpisy, więc best to wartość pierwszego.
export function recordBarPercent(value: number, best: number, lowerIsBetter: boolean): number {
  return Math.min(100, Math.max(0, Math.round(ratio(value, best, lowerIsBetter) * 100)));
}
