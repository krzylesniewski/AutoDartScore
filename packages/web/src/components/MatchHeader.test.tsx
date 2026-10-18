import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { casual, player, snapshot } from '../test/snapshots';
import { MatchHeader } from './MatchHeader';

describe('MatchHeader', () => {
  it('shows the match chips', () => {
    render(<MatchHeader state={snapshot()} voiceEnabled={false} onVoiceChange={vi.fn()} />);
    expect(screen.getByText('AUTO Score')).toBeTruthy();
    expect(screen.getByText('501')).toBeTruthy();
    expect(screen.getByText('Double-out')).toBeTruthy();
    expect(screen.getByText('Best of 3')).toBeTruthy();
    expect(screen.getByText('Leg 1')).toBeTruthy();
    expect(screen.queryByText('Zabawa')).toBeNull();
  });

  it('shows Zabawa and no Best of in a casual game', () => {
    render(<MatchHeader state={casual(['Anna', 'Bartek', 'Celina'])} voiceEnabled={false} onVoiceChange={vi.fn()} />);
    expect(screen.getByText('Zabawa')).toBeTruthy();
    expect(screen.getByText('501')).toBeTruthy();
    expect(screen.queryByText(/Best of/)).toBeNull();
    expect(screen.queryByText(/^Leg /)).toBeNull();
  });

  it('shows Free run without a score or Double-out', () => {
    const state = snapshot({
      type: 'practice',
      practiceMode: 'free_run',
      startingScore: null,
      legsToWin: null,
      players: [player('p1', 'Anna', { remaining: null })],
    });
    render(<MatchHeader state={state} voiceEnabled={false} onVoiceChange={vi.fn()} />);
    expect(screen.getByText('Free run')).toBeTruthy();
    expect(screen.queryByText('Double-out')).toBeNull();
  });

  it('keeps the voice toggle without a state', () => {
    const onVoiceChange = vi.fn();
    render(<MatchHeader state={null} voiceEnabled={false} onVoiceChange={onVoiceChange} />);
    screen.getByRole('button', { name: 'Głos' }).click();
    expect(onVoiceChange).toHaveBeenCalledWith(true);
    expect(screen.queryByText('Double-out')).toBeNull();
  });
});
