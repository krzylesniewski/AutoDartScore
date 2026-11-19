import { createContext, useContext } from 'react';
import { tournamentMatchHref, type MatchHref } from '../game/tournament-match-href';

// Tabela, drabinka i rekordy są wspólne dla ekranu turnieju i publicznego podglądu. Publiczny podgląd podaje tu
// linki #/t/..., a bez dostawcy zostają linki do prywatnej strony meczu.
export const MatchHrefContext = createContext<MatchHref>(tournamentMatchHref);

export function useMatchHref(): MatchHref {
  return useContext(MatchHrefContext);
}
