import type { RankedPlayer } from '@autoscore/schema';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { podiumSlots } from '../game/podium';
import { Podium } from './Podium';

function ranked(playerId: string, name: string, position: number | null, average: number): RankedPlayer {
  return { playerId, name, avatar: null, color: 1, position, average, legs: 5 };
}

function renderPodium(players: RankedPlayer[]): HTMLElement[] {
  render(<Podium slots={podiumSlots(players).podium} />);
  return within(screen.getByRole('list', { name: 'Podium średniej' })).getAllByRole('listitem');
}

function order(item: HTMLElement): string | undefined {
  return item.getAttribute('class')?.split(' ').find((name) => /^order-\d$/.test(name));
}

describe('Podium', () => {
  const three = [ranked('p1', 'Anna', 1, 61.5), ranked('p2', 'Bartek', 2, 55.25), ranked('p3', 'Celina', 3, 40)];

  it('keeps the DOM in rank order and shows the order 2 · 1 · 3 through classes', () => {
    const items = renderPodium(three);
    expect(items.map((item) => within(item).getByRole('link').textContent)).toEqual(['AAnna61,50Miejsce 15 legów', 'BBartek55,25Miejsce 25 legów', 'CCelina40,00Miejsce 35 legów']);
    expect(items.map(order)).toEqual(['order-2', 'order-1', 'order-3']);
    const visual = [...items].sort((a, b) => (order(a) ?? '').localeCompare(order(b) ?? '')).map((item) => item.textContent?.match(/Miejsce \d/)?.[0]);
    expect(visual).toEqual(['Miejsce 2', 'Miejsce 1', 'Miejsce 3']);
  });

  it('shows the place as text and the value on each item', () => {
    const items = renderPodium(three);
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Miejsce 1'),
      expect.stringContaining('Miejsce 2'),
      expect.stringContaining('Miejsce 3'),
    ]);
    expect(items.map((item) => item.textContent)).toEqual([expect.stringContaining('61,50'), expect.stringContaining('55,25'), expect.stringContaining('40,00')]);
    expect(items.filter((item) => item.hasAttribute('data-leader'))).toEqual([items[0]]);
  });

  it('links each item to the player card', () => {
    const items = renderPodium([ranked('a b', 'Anna', 1, 61.5), ranked('p2', 'Bartek', 2, 55.25), ranked('p3', 'Celina', 3, 40)]);
    expect(items.map((item) => within(item).getByRole('link').getAttribute('href'))).toEqual(['#/stats/a%20b', '#/stats/p2', '#/stats/p3']);
  });

  it('shows Miejsce 1 twice for a tie', () => {
    const items = renderPodium([ranked('p1', 'Anna', 1, 50), ranked('p2', 'Bartek', 1, 50), ranked('p3', 'Celina', 3, 40)]);
    expect(items.map((item) => item.textContent?.match(/Miejsce \d/)?.[0])).toEqual(['Miejsce 1', 'Miejsce 1', 'Miejsce 3']);
  });

  it('renders only two items for two ranked players', () => {
    const items = renderPodium([ranked('p1', 'Anna', 1, 61.5), ranked('p2', 'Bartek', 2, 55.25), ranked('p4', 'Darek', null, 70)]);
    expect(items).toHaveLength(2);
    expect(screen.queryByText('Darek')).toBeNull();
  });

  it('hides the decorative light from screen readers', () => {
    const { container } = render(<Podium slots={podiumSlots(three).podium} />);
    const light = [...container.querySelectorAll('[aria-hidden="true"]')].find((element) => element.getAttribute('class')?.includes('bg-radial'));
    expect(light).toBeTruthy();
    expect(light?.textContent).toBe('');
  });
});
