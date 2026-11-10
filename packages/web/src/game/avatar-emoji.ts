// Gotowe emoji do wyboru w oknie gracza, w trzech grupach po 10 (kolejność jak w pl.avatarGroups).
export const AVATAR_EMOJI_GROUPS: readonly (readonly string[])[] = [
  ['🎮', '🕹️', '👾', '🎲', '🃏', '🎬', '🍿', '🦸', '🦹', '⚔️'],
  ['🎯', '🏆', '🥇', '🔥', '⚡', '👑', '💎', '🚀', '🍺', '💪'],
  ['😎', '🤠', '🥷', '🧙', '🧛', '🧟', '👽', '🤖', '👻', '💀'],
];

export const AVATAR_EMOJI: readonly string[] = AVATAR_EMOJI_GROUPS.flat();
