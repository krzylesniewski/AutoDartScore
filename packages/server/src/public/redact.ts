import {
  isSingleEmoji,
  type MatchSnapshot,
  type PublicMatch,
  type PublicMatchPlayer,
  type PublicTournamentPlayer,
  type PublicTournamentView,
  type TournamentView,
} from '@autoscore/schema';

// Pola przepisujemy po kolei, bez rozpakowania prywatnego obiektu, żeby nowe prywatne pole nie wyciekło samo.

// Zapisany wcześniej avatar może być adresem zdjęcia albo data URL. Na zewnątrz idzie tylko emoji.
export function publicAvatar(avatar: string | null): string | null {
  return avatar !== null && isSingleEmoji(avatar) ? avatar : null;
}

export function publicTournamentView(view: TournamentView): PublicTournamentView {
  return {
    id: view.id,
    name: view.name,
    format: view.format,
    config: view.config,
    status: view.status,
    createdAt: view.createdAt,
    finishedAt: view.finishedAt,
    players: view.players.map((player): PublicTournamentPlayer => ({
      id: player.id,
      name: player.name,
      avatar: publicAvatar(player.avatar),
      color: player.color,
    })),
    fixtures: view.fixtures,
    standings: view.standings,
    nextFixtureId: view.nextFixtureId,
    liveFixtureId: view.liveFixtureId,
    placements: view.placements,
  };
}

export function publicMatch(snapshot: MatchSnapshot): PublicMatch {
  return {
    id: snapshot.id,
    status: snapshot.status,
    startingScore: snapshot.startingScore,
    legsToWin: snapshot.legsToWin,
    createdAt: snapshot.createdAt,
    startedAt: snapshot.startedAt,
    finishedAt: snapshot.finishedAt,
    pausedMs: snapshot.pausedMs,
    currentPlayerId: snapshot.currentPlayerId,
    winnerId: snapshot.winnerId,
    players: snapshot.players.map((player): PublicMatchPlayer => ({
      id: player.id,
      name: player.name,
      avatar: publicAvatar(player.avatar),
      color: player.color,
      legsWon: player.legsWon,
      remaining: player.remaining,
    })),
  };
}
