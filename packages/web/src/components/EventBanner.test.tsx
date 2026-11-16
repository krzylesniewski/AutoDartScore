import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EventBanner } from './EventBanner';

describe('EventBanner', () => {
  it('announces a bust with an icon, the text and the player', () => {
    render(<EventBanner banner={{ kind: 'bust', playerName: 'Anna', place: null }} achievements={[]} />);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('BustAnna');
    expect(status.querySelector('svg')).not.toBeNull();
  });

  it('announces a won leg with a trophy, the text and the place', () => {
    render(<EventBanner banner={{ kind: 'win', playerName: 'Anna', place: 1 }} achievements={[]} />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Anna');
    expect(status.textContent).not.toContain('Bust');
    expect(status.querySelector('svg')).not.toBeNull();
  });

  it('keeps an empty live region without a banner', () => {
    render(<EventBanner banner={null} achievements={[]} />);
    expect(screen.getByRole('status').textContent).toBe('');
  });
});
