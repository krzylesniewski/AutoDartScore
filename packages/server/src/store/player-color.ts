import { PLAYER_COLOR_COUNT } from '@autoscore/schema';

// Kolor gracza bez zapisanego wyboru. Zależy tylko od id, więc gracz ma ten sam kolor na każdym ekranie i po restarcie.
export function defaultPlayerColor(id: string): number {
  let sum = 0;
  for (let index = 0; index < id.length; index++) {
    sum += id.charCodeAt(index);
  }
  return (sum % PLAYER_COLOR_COUNT) + 1;
}
