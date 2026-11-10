import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EventBanner } from './EventBanner';

describe('EventBanner', () => {
  it('shows a bust in the accent block with an icon and the text', () => {
    render(<EventBanner banner={{ kind: 'bust', playerName: 'Anna', place: null }} achievements={[]} />);
    const banner = screen.getByText('Bust').parentElement;
    expect(banner?.className.split(' ')).toEqual(expect.arrayContaining(['sc-checkout', 'rounded-(--radius-card)', 'font-bold', 'text-3xl']));
    expect(banner?.querySelector('svg')).not.toBeNull();
    expect(banner?.textContent).toContain('Anna');
  });

  it('keeps a won leg cream with a trophy and a card shadow', () => {
    render(<EventBanner banner={{ kind: 'win', playerName: 'Anna', place: 1 }} achievements={[]} />);
    const banner = screen.getByText('Anna').parentElement;
    expect(banner?.className.split(' ')).toEqual(expect.arrayContaining(['bg-(--color-text)', 'text-(--color-text-inverse)', 'shadow-(--shadow-card)']));
    expect(banner?.className.split(' ')).not.toContain('sc-checkout');
    expect(banner?.querySelector('svg')).not.toBeNull();
  });

  it('keeps the live region without a banner', () => {
    render(<EventBanner banner={null} achievements={[]} />);
    expect(screen.getByRole('status').className.split(' ')).toEqual(expect.arrayContaining(['absolute', 'top-0', 'pointer-events-none']));
  });
});
