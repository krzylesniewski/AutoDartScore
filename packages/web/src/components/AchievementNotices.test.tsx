import type { Achievement } from '@autoscore/schema';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AchievementNotice } from '../api/use-match';
import { pl } from '../i18n/pl';
import { AchievementNotices } from './AchievementNotices';

function notice(playerName: string, overrides: Partial<Achievement> = {}): AchievementNotice {
  return {
    playerName,
    achievement: { type: 'achievement', matchId: 'm_1', eventSeq: 5, playerId: 'p1', kind: 'turn_record', value: 140, previous: 121, ...overrides },
  };
}

describe('AchievementNotices', () => {
  it('renders nothing without notices', () => {
    const { container } = render(<AchievementNotices notices={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('lists each notice with a star, the player name and the text', () => {
    render(<AchievementNotices notices={[notice('Anna'), notice('Bartek', { playerId: 'p2', kind: 'longest_leg', value: 42, previous: 39 })]} />);
    const items = within(screen.getByRole('list', { name: pl.achievements })).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['Anna Rekord tury: 140 (było 121)', 'Bartek Najdłuższy leg: 42 lotki (było 39)']);
    for (const item of items) {
      expect(item.querySelector('svg')).not.toBeNull();
    }
  });

  it('uses theme tokens and no hard-coded colours', () => {
    render(<AchievementNotices notices={[notice('Anna')]} />);
    const item = screen.getByRole('listitem');
    expect(item.className.split(' ')).toEqual(
      expect.arrayContaining(['bg-(--color-surface)', 'border-(--color-accent)', 'text-(--color-text)', 'animate-banner-in', 'motion-reduce:animate-none']),
    );
    expect(item.className).not.toMatch(/#[0-9a-f]{3}/i);
  });
});
