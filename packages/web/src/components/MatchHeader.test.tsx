import type { MatchSnapshot } from '@autoscore/schema';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('offers Porzuć mecz in a 1v1 from the start, before the first leg is completed', () => {
    render(<MatchHeader state={snapshot({ legIndex: 0 })} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} onAbandon={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Porzuć mecz' })).toBeTruthy();
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

    it('offers only Zakończ trening in a Free run and both buttons in a Solo 501', () => {
      const { unmount } = render(<MatchHeader state={freeRun(1)} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} onAbandon={vi.fn()} onEndPractice={vi.fn()} />);
      expect(screen.queryByRole('button', { name: 'Porzuć mecz' })).toBeNull();
      unmount();

      const solo = snapshot({ type: 'practice', practiceMode: 'solo_501', legsToWin: null, players: [player('p1', 'Anna', { dartsThrownInLeg: 3 })] });
      render(<MatchHeader state={solo} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} onAbandon={vi.fn()} onEndPractice={vi.fn()} />);
      expect(screen.getByRole('button', { name: 'Porzuć mecz' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Zakończ trening' })).toBeTruthy();
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

  describe('menu', () => {
    function toggle(): HTMLElement {
      return screen.getByRole('button', { name: 'Menu gry' });
    }

    function panel(): HTMLElement {
      const panelElement = document.getElementById(toggle().getAttribute('aria-controls') ?? '');
      if (!panelElement) {
        throw new Error('no panel');
      }
      return panelElement;
    }

    it('opens and closes the panel with the toggle', () => {
      render(<MatchHeader state={snapshot()} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} />);
      expect(toggle().classList.contains('lg:hidden')).toBe(true);
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      expect(panel().classList.contains('hidden')).toBe(true);
      expect(panel().classList.contains('lg:contents')).toBe(true);
      expect(panel().contains(screen.getByText('Best of 3'))).toBe(true);

      fireEvent.click(toggle());
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(panel().classList.contains('hidden')).toBe(false);

      fireEvent.click(toggle());
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      expect(panel().classList.contains('hidden')).toBe(true);
    });

    it('closes on Escape and returns the focus to the toggle', () => {
      render(<MatchHeader state={snapshot()} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} />);
      fireEvent.click(toggle());
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      expect(panel().classList.contains('hidden')).toBe(true);
      expect(document.activeElement).toBe(toggle());
    });

    it('calls onAbandon from the menu and closes it', () => {
      const onAbandon = vi.fn();
      render(<MatchHeader state={snapshot({ legIndex: 1 })} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} onAbandon={onAbandon} />);
      fireEvent.click(toggle());
      fireEvent.click(screen.getByRole('button', { name: 'Porzuć mecz' }));
      expect(onAbandon).toHaveBeenCalled();
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
    });

    it('stays open after the voice toggle', () => {
      const onVoiceChange = vi.fn();
      render(<MatchHeader state={snapshot()} voiceEnabled={false} onVoiceChange={onVoiceChange} effectsEnabled={true} onEffectsChange={vi.fn()} />);
      fireEvent.click(toggle());
      fireEvent.click(screen.getByRole('button', { name: 'Głos' }));
      expect(onVoiceChange).toHaveBeenCalledWith(true);
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
    });

    it('keeps the status chip in the bar, orders it before the actions and renders each action once', () => {
      const onResume = vi.fn();
      const state = snapshot({ status: 'abandoned', abandonment: { playerId: 'p1', reason: null, at: '2026-10-15T19:00:00.000Z' } });
      render(<MatchHeader state={state} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} onResume={onResume} />);
      expect(panel().contains(screen.getByText('Porzucony'))).toBe(false);
      const order = (element: Element | null | undefined) => element?.className.split(' ').find((name) => name.startsWith('lg:order-'));
      expect(order(screen.getByText('501').closest('ul'))).toBe('lg:order-1');
      expect(order(screen.getByRole('timer').parentElement)).toBe('lg:order-2');
      expect(order(screen.getByText('Porzucony').closest('span'))).toBe('lg:order-3');
      expect(order(screen.getByRole('button', { name: 'Wznów mecz' }).parentElement)).toBe('lg:order-4');
      for (const name of ['Wznów mecz', 'Głos', 'Efekty dźwiękowe', 'Menu gry']) {
        expect(screen.getAllByRole('button', { name })).toHaveLength(1);
      }
      fireEvent.click(toggle());
      fireEvent.click(screen.getByRole('button', { name: 'Wznów mecz' }));
      expect(onResume).toHaveBeenCalled();
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
    });

    it('renders Porzuć mecz and Zakończ trening once', () => {
      const { unmount } = render(
        <MatchHeader state={snapshot({ legIndex: 1 })} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} onAbandon={vi.fn()} />,
      );
      expect(screen.getAllByRole('button', { name: 'Porzuć mecz' })).toHaveLength(1);
      unmount();

      const onEndPractice = vi.fn();
      const freeRun = snapshot({
        type: 'practice',
        practiceMode: 'free_run',
        startingScore: null,
        legsToWin: null,
        players: [player('p1', 'Anna', { remaining: null, dartsThrownInLeg: 1 })],
      });
      render(<MatchHeader state={freeRun} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} onEndPractice={onEndPractice} />);
      expect(screen.getAllByRole('button', { name: 'Zakończ trening' })).toHaveLength(1);
      fireEvent.click(toggle());
      fireEvent.click(screen.getByRole('button', { name: 'Zakończ trening' }));
      expect(onEndPractice).toHaveBeenCalled();
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('round and leg clock', () => {
    const NOW = '2026-10-21T18:10:41.000Z';
    const freeRun = (overrides: Partial<MatchSnapshot> = {}) =>
      snapshot({
        type: 'practice',
        practiceMode: 'free_run',
        startingScore: null,
        legsToWin: null,
        round: null,
        players: [player('p1', 'Anna', { remaining: null, dartsThrownInLeg: 1 })],
        ...overrides,
      });

    function renderHeader(state: MatchSnapshot) {
      return render(<MatchHeader state={state} voiceEnabled={false} onVoiceChange={vi.fn()} effectsEnabled={true} onEffectsChange={vi.fn()} />);
    }

    function tick(ms: number): void {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    }

    function startClock(): void {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(NOW));
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      ['a 1v1', snapshot({ round: 7 })],
      ['a casual game', casual(['Anna', 'Bartek', 'Celina'], { round: 7 })],
      ['Solo 501', snapshot({ type: 'practice', practiceMode: 'solo_501', legsToWin: null, round: 7, players: [player('p1', 'Anna')] })],
    ])('shows Kolejka 7 in %s', (_name, state) => {
      renderHeader(state);
      expect(screen.getByText('Kolejka 7')).toBeTruthy();
      expect(screen.getByRole('timer', { name: 'Czas lega 0 min 0 s' })).toBeTruthy();
    });

    it('shows only the session clock in Free run', () => {
      startClock();
      renderHeader(freeRun({ startedAt: '2026-10-21T18:00:00.000Z', legStartedAt: '2026-10-21T18:00:00.000Z' }));
      expect(screen.queryByText(/^Kolejka/)).toBeNull();
      expect(screen.getByRole('timer', { name: 'Czas sesji 10 min 41 s' }).textContent).toContain('10:41');
      expect(screen.queryByRole('timer', { name: /^Czas lega/ })).toBeNull();
    });

    it('ticks every second without aria-live', () => {
      startClock();
      renderHeader(snapshot({ legStartedAt: '2026-10-21T18:10:00.000Z' }));
      const timer = screen.getByRole('timer', { name: 'Czas lega 0 min 41 s' });
      expect(timer.textContent).toContain('0:41');
      expect(timer.hasAttribute('aria-live')).toBe(false);
      expect(timer.closest('[aria-live]')).toBeNull();
      tick(1000);
      expect(timer.textContent).toContain('0:42');
      expect(timer.getAttribute('aria-label')).toBe('Czas lega 0 min 42 s');
    });

    it('leaves out the closed pauses of the leg', () => {
      startClock();
      renderHeader(snapshot({ legStartedAt: '2026-10-21T18:00:00.000Z', legPausedMs: 300_000 }));
      expect(screen.getByRole('timer', { name: 'Czas lega 5 min 41 s' })).toBeTruthy();
    });

    it('stands still in an abandoned game', () => {
      startClock();
      const abandonment = { playerId: 'p1', reason: null, at: '2026-10-21T18:05:00.000Z' };
      renderHeader(snapshot({ status: 'abandoned', abandonment, round: 3, legStartedAt: '2026-10-21T18:00:00.000Z', legPausedMs: 60_000 }));
      expect(screen.getByText('Kolejka 3')).toBeTruthy();
      const timer = screen.getByRole('timer', { name: 'Czas lega 4 min 0 s' });
      tick(5000);
      expect(timer.textContent).toContain('4:00');
      expect(vi.getTimerCount()).toBe(0);
    });

    it('stands still at the end of an ended practice', () => {
      startClock();
      renderHeader(freeRun({ status: 'ended', endedAt: '2026-10-21T18:02:03.000Z', startedAt: '2026-10-21T18:00:00.000Z', legStartedAt: '2026-10-21T18:00:00.000Z' }));
      expect(screen.getByRole('timer', { name: 'Czas sesji 2 min 3 s' })).toBeTruthy();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('shows 0:00 and does not tick before the first dart of a leg', () => {
      startClock();
      renderHeader(snapshot({ legIndex: 1, startedAt: '2026-10-21T18:00:00.000Z', legStartedAt: null }));
      const timer = screen.getByRole('timer', { name: 'Czas lega 0 min 0 s' });
      expect(timer.textContent).toContain('0:00');
      expect(vi.getTimerCount()).toBe(0);
    });

    it('shows hours past an hour', () => {
      startClock();
      renderHeader(snapshot({ legStartedAt: '2026-10-21T17:08:38.000Z' }));
      expect(screen.getByRole('timer', { name: 'Czas lega 1 godz. 2 min 3 s' }).textContent).toContain('1:02:03');
    });

    it('shows neither round nor clock after the game ends', () => {
      renderHeader(snapshot({ finished: true, round: null, startedAt: '2026-10-21T18:00:00.000Z', legStartedAt: '2026-10-21T18:00:00.000Z', finishedAt: NOW }));
      expect(screen.queryByText(/^Kolejka/)).toBeNull();
      expect(screen.queryByRole('timer')).toBeNull();
    });

    it('keeps round and clock outside the collapsible panel', () => {
      renderHeader(snapshot({ round: 7 }));
      const toggle = screen.getByRole('button', { name: 'Menu gry' });
      const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
      expect(panel?.classList.contains('hidden')).toBe(true);
      expect(panel?.contains(screen.getByText('Kolejka 7'))).toBe(false);
      expect(panel?.contains(screen.getByRole('timer'))).toBe(false);
    });
  });
});
