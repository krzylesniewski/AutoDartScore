import type { LegTurn, MatchSnapshot, MatchSnapshotPlayer } from '@autoscore/schema';

export type TurnHistoryCell =
  | { kind: 'turn'; remainingAfter: number | null; points: number; bust: boolean; place: number | null }
  | { kind: 'current' }
  | { kind: 'out' }
  | { kind: 'empty' };

export interface TurnHistoryModel {
  columns: MatchSnapshotPlayer[];
  // rows[r][c]: r-ta tura gracza z kolumny c. Numer tury to r + 1.
  rows: TurnHistoryCell[][];
  // Indeks w rows, null poza trwającą grą.
  currentRow: number | null;
}

// Silniki rzucają po kolei z listy graczy, zaczynając od gracza, który zaczął leg. Kolumny idą w tej samej kolejności.
function columnsOf(state: MatchSnapshot): MatchSnapshotPlayer[] {
  const starterId = state.legTurns[0]?.playerId ?? state.currentPlayerId;
  const start = state.players.findIndex((player) => player.id === starterId);
  if (start <= 0) {
    return [...state.players];
  }
  return [...state.players.slice(start), ...state.players.slice(0, start)];
}

function turnCell(turn: LegTurn, player: MatchSnapshotPlayer): TurnHistoryCell {
  const closing = !turn.bust && turn.remainingAfter === 0;
  return { kind: 'turn', remainingAfter: turn.remainingAfter, points: turn.points, bust: turn.bust, place: closing ? player.place : null };
}

export function turnHistory(state: MatchSnapshot): TurnHistoryModel {
  const columns = columnsOf(state);
  const turnsByPlayer = columns.map((player) => state.legTurns.filter((turn) => turn.playerId === player.id));
  const throwerColumn = columns.findIndex((player) => player.id === state.currentPlayerId);
  const throwerTurns = turnsByPlayer[throwerColumn];
  const currentRow = state.status === 'in_progress' && throwerTurns ? throwerTurns.length : null;
  const rowCount = Math.max(0, ...turnsByPlayer.map((turns) => turns.length), currentRow === null ? 0 : currentRow + 1);

  const rows = Array.from({ length: rowCount }, (_, row) =>
    columns.map((player, column): TurnHistoryCell => {
      const turns = turnsByPlayer[column] ?? [];
      const turn = turns[row];
      if (turn) {
        return turnCell(turn, player);
      }
      if (row === currentRow && column === throwerColumn) {
        return { kind: 'current' };
      }
      // Gracz zabawy, który zamknął leg, wypadł z kolejki. Ostatni gracz dostaje miejsce bez zamknięcia, więc nie ma takich komórek.
      const closed = turns.at(-1)?.remainingAfter === 0;
      if (player.place !== null && closed) {
        return { kind: 'out' };
      }
      return { kind: 'empty' };
    }),
  );

  return { columns, rows, currentRow };
}
