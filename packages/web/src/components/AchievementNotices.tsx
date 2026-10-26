import type { AchievementNotice } from '../api/use-match';
import { achievementText } from '../game/achievement-text';
import { pl } from '../i18n/pl';
import { StarIcon } from './icons';

// Mniejsze niż baner bust, żeby cztery osiągnięcia i baner wygranej zmieściły się nad klawiaturą na telefonie.
export function AchievementNotices({ notices }: { notices: readonly AchievementNotice[] }) {
  if (notices.length === 0) {
    return null;
  }
  return (
    <ul aria-label={pl.achievements} className="flex flex-col gap-2">
      {notices.map(({ achievement, playerName }) => (
        <li
          key={`${achievement.eventSeq}-${achievement.kind}-${achievement.playerId}`}
          className="flex animate-banner-in items-center gap-3 rounded-(--radius-card) border-(length:--border-width) border-(--color-accent) bg-(--color-surface) px-4 py-2 font-display text-lg font-semibold text-(--color-text) motion-reduce:animate-none lg:text-xl"
        >
          <StarIcon className="text-(--color-accent)" />
          <span className="min-w-0 break-words">
            <span className="font-bold">{playerName}</span> {achievementText(achievement)}
          </span>
        </li>
      ))}
    </ul>
  );
}
