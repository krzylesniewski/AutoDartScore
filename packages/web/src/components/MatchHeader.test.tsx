import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { casual, player, snapshot } from '../test/snapshots';
import { MatchHeader } from './MatchHeader';

describe('MatchHeader', () => {
  it('shows the match chips', () => {
    render(<MatchHeader state={snapshot()} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} />);
    expect(screen.getByText('AUTO Score')).toBeTruthy();
    expect(screen.getByText('501')).toBeTruthy();
    expect(screen.getByText('Double-out')).toBeTruthy();
    expect(screen.getByText('Best of 3')).toBeTruthy();
    expect(screen.getByText('Leg 1')).toBeTruthy();
    expect(screen.queryByText('Zabawa')).toBeNull();
  });

  it('shows Zabawa and no Best of in a casual game', () => {
    render(<MatchHeader state={casual(['Anna', 'Bartek', 'Celina'])} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} />);
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
    render(<MatchHeader state={state} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} />);
    expect(screen.getByText('Free run')).toBeTruthy();
    expect(screen.queryByText('Double-out')).toBeNull();
  });

  it('keeps the voice toggle without a state', () => {
    const onVoiceChange = vi.fn();
    render(<MatchHeader state={null} voiceEnabled={false} onVoiceChange={onVoiceChange} effectsEnabled={true} onEffectsChange={vi.fn()} />);
    screen.getByRole('button', { name: 'Głos' }).click();
    expect(onVoiceChange).toHaveBeenCalledWith(true);
    expect(screen.queryByText('Double-out')).toBeNull();
  });

  it('turns the effects off from the header', () => {
    const onEffectsChange = vi.fn();
    render(<MatchHeader state={snapshot()} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={onEffectsChange} />);
    const toggle = screen.getByRole('button', { name: 'Efekty dźwiękowe' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    toggle.click();
    expect(onEffectsChange).toHaveBeenCalledWith(false);
  });

  it('links the app name to the home screen', () => {
    render(<MatchHeader state={null} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Ekran startowy' }).getAttribute('href')).toBe('#/');
  });

  it('hides Porzuć mecz in a 1v1 before the first leg is completed', () => {
    render(<MatchHeader state={snapshot({ legIndex: 0 })} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} onAbandon={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Porzuć mecz' })).toBeNull();
  });

  it('offers Porzuć mecz in a game in progress with a completed leg', () => {
    const onAbandon = vi.fn();
    render(<MatchHeader state={snapshot({ legIndex: 1 })} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} onAbandon={onAbandon} />);
    screen.getByRole('button', { name: 'Porzuć mecz' }).click();
    expect(onAbandon).toHaveBeenCalled();
    expect(screen.queryByText('Porzucony')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Wznów mecz' })).toBeNull();
  });

  it('shows the Porzucony badge and Wznów mecz in an abandoned game', () => {
    const onResume = vi.fn();
    const state = snapshot({ status: 'abandoned', abandonment: { playerId: 'p1', reason: null, at: '2026-10-15T19:00:00.000Z' } });
    render(<MatchHeader state={state} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} onResume={onResume} />);
    expect(screen.getByText('Porzucony')).toBeTruthy();
    screen.getByRole('button', { name: 'Wznów mecz' }).click();
    expect(onResume).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Porzuć mecz' })).toBeNull();
  });

  it('shows neither in a finished game', () => {
    render(<MatchHeader state={snapshot({ finished: true })} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Porzuć mecz' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Wznów mecz' })).toBeNull();
    expect(screen.queryByText('Porzucony')).toBeNull();
  });

  describe('practice', () => {
    const freeRun = (darts: number) =>
      snapshot({
        type: 'practice',
        practiceMode: 'free_run',
        startingScore: null,
        legsToWin: null,
        players: [player('p1', 'Anna', { remaining: null, dartsThrownInLeg: darts })],
      });

    it('offers Zakończ trening after the first dart', () => {
      const onEndPractice = vi.fn();
      render(<MatchHeader state={freeRun(1)} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} onEndPractice={onEndPractice} />);
      screen.getByRole('button', { name: 'Zakończ trening' }).click();
      expect(onEndPractice).toHaveBeenCalled();
      expect(screen.queryByText('Zakończony')).toBeNull();
    });

    it('hides Zakończ trening with 0 darts and in a 1v1', () => {
      const { unmount } = render(<MatchHeader state={freeRun(0)} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} onEndPractice={vi.fn()} />);
      expect(screen.queryByRole('button', { name: 'Zakończ trening' })).toBeNull();
      unmount();

      const match = snapshot({ legIndex: 1, players: [player('p1', 'Anna', { legsWon: 1, dartsThrownInLeg: 3 }), player('p2', 'Bartek', { legsWon: 0, dartsThrownInLeg: 3 })] });
      render(<MatchHeader state={match} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} onEndPractice={vi.fn()} />);
      expect(screen.queryByRole('button', { name: 'Zakończ trening' })).toBeNull();
    });

    it('shows the Zakończony chip with an icon and no resume in an ended session', () => {
      const state = { ...freeRun(4), status: 'ended' as const, endedAt: '2026-10-15T19:00:00.000Z' };
      render(<MatchHeader state={state} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} onEndPractice={vi.fn()} onResume={vi.fn()} />);
      const chip = screen.getByText('Zakończony');
      expect(chip.querySelector('svg')).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Zakończ trening' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Wznów mecz' })).toBeNull();
    });
  });
});
