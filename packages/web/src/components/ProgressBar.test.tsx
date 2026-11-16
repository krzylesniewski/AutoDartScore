import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('names the remaining score for screen readers', () => {
    render(<ProgressBar startingScore={300} remaining={150} current={false} />);
    expect(screen.getByRole('img', { name: 'Zostało 150 z 300 punktów' })).toBeTruthy();
  });

  it('fills the knocked-off share of the starting score', () => {
    render(<ProgressBar startingScore={300} remaining={150} current={false} />);
    const fill = screen.getByRole('img').firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('50%');
  });
});
