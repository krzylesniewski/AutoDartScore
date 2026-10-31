import type { Hit } from '@autoscore/schema';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { player, reviewedThrow, snapshot } from '../test/snapshots';
import { TurnPanel } from './TurnPanel';

const onUndo = () => undefined;
const onCheckout = () => undefined;
const review = { selectedPendingId: null, onSelectPending: () => undefined, onFlag: () => undefined, flagDisabled: true };

describe('TurnPanel', () => {
  it('shows the thrower, the darts with points and the checkout', () => {
    const state = snapshot({
      currentPlayerId: 'p1',
      currentDarts: [
        { segment: 20, multiplier: 3 },
        { segment: 19, multiplier: 3 },
      ],
      players: [player('p1', 'Anna', { remaining: 24, legsWon: 0 }), player('p2', 'Bartek', { legsWon: 0 })],
    });
    render(<TurnPanel {...review} state={state} lastTurn={null} busy={false} onUndo={onUndo} onCheckout={onCheckout} checkoutDisabled={false} />);
    expect(screen.getByText('Anna rzuca')).toBeTruthy();
    expect(screen.getByText('Rzutka 3 z 3')).toBeTruthy();
    expect(screen.getByText('60')).toBeTruthy();
    expect(screen.getByText('57')).toBeTruthy();
    expect(screen.getByText('60 + 57')).toBeTruthy();
    expect(screen.getByText('117')).toBeTruthy();
    expect(screen.getAllByText('czeka na rzutkę')).toHaveLength(1);
    expect(screen.getByLabelText('Rzutka 3').textContent).toContain('czeka na rzutkę');
    expect(screen.getByText('D12')).toBeTruthy();
    expect(screen.getByText('1 rzutka do wygrania lega')).toBeTruthy();
  });

  it('shows no heading and no waiting slot once the match is over', () => {
    const state = snapshot({
      finished: true,
      currentPlayerId: null,
      winnerId: 'p1',
      players: [player('p1', 'Anna', { remaining: 0, legsWon: 2 }), player('p2', 'Bartek', { legsWon: 1 })],
    });
    render(<TurnPanel {...review} state={state} lastTurn={null} busy={false} onUndo={onUndo} onCheckout={onCheckout} checkoutDisabled={false} />);
    expect(screen.queryByText(/rzuca/)).toBeNull();
    expect(screen.queryByText('czeka na rzutkę')).toBeNull();
  });

  it('shows the time left on Cofnij in a finished game', () => {
    const state = snapshot({ finished: true, currentPlayerId: null, winnerId: 'p1' });
    render(<TurnPanel {...review} state={state} lastTurn={null} busy={false} undoCountdown="4:12" onUndo={onUndo} onCheckout={onCheckout} checkoutDisabled={false} />);
    const button = screen.getByRole('button', { name: 'Cofnij (4:12)' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.className.split(' ')).toContain('tabular-nums');
  });

  it('shows a plain Cofnij without a countdown', () => {
    render(<TurnPanel {...review} state={snapshot()} lastTurn={null} busy={false} onUndo={onUndo} onCheckout={onCheckout} checkoutDisabled={false} />);
    expect(screen.getByRole('button', { name: 'Cofnij' })).toBeTruthy();
  });

  it('keeps an invisible checkout placeholder without a route', () => {
    const state = snapshot({ currentPlayerId: 'p1', players: [player('p1', 'Anna', { remaining: 301, legsWon: 0 }), player('p2', 'Bartek', { legsWon: 0 })] });
    const { container } = render(<TurnPanel {...review} state={state} lastTurn={null} busy={false} onUndo={onUndo} onCheckout={onCheckout} checkoutDisabled={false} />);
    expect(container.querySelector('[aria-hidden="true"].invisible.max-lg\\:hidden')).not.toBeNull();
    expect(screen.queryByText('Zamknięcie')).toBeNull();
    expect(screen.queryByText(/do wygrania lega/)).toBeNull();
  });

  it('has no checkout placeholder in Free run', () => {
    const state = snapshot({ startingScore: null, currentPlayerId: 'p1', players: [player('p1', 'Anna', { remaining: null, legsWon: 0 })] });
    const { container } = render(<TurnPanel {...review} state={state} lastTurn={null} busy={false} onUndo={onUndo} onCheckout={onCheckout} checkoutDisabled={false} />);
    expect(container.querySelector('.invisible')).toBeNull();
  });

  it('keeps an empty name line without a closed turn', () => {
    const state = snapshot({ currentPlayerId: 'p1', players: [player('p1', 'Anna', { remaining: 301, legsWon: 0 }), player('p2', 'Bartek', { legsWon: 0 })] });
    const { container } = render(<TurnPanel {...review} state={state} lastTurn={null} busy={false} onUndo={onUndo} onCheckout={onCheckout} checkoutDisabled={false} />);
    const line = container.querySelector('p[aria-hidden="true"]');
    expect(line?.className.split(' ')).toContain('max-lg:hidden');
    expect(line?.textContent).toBe('\u00a0');
  });

  describe('checkout entry', () => {
    const state = snapshot({
      currentPlayerId: 'p1',
      currentDarts: [{ segment: 20, multiplier: 1 }],
      players: [player('p1', 'Anna', { remaining: 100, legsWon: 0 }), player('p2', 'Bartek', { legsWon: 0 })],
    });

    function renderPanel(checkoutDisabled = false) {
      const onCheckoutHit = vi.fn<(hit: Hit) => void>();
      render(<TurnPanel {...review} state={state} lastTurn={null} busy={false} onUndo={onUndo} onCheckout={onCheckoutHit} checkoutDisabled={checkoutDisabled} />);
      const card = screen.getByRole('button', { name: /Zamknięcie/ }) as HTMLButtonElement;
      return { onCheckoutHit, card };
    }

    it('renders the route as a button with the hint for the first dart', () => {
      const { card } = renderPanel();
      expect(card.getAttribute('type')).toBe('button');
      expect(card.getAttribute('aria-keyshortcuts')).toBe('Enter');
      expect(card.textContent).toContain('T20 D20');
      expect(screen.getByText('Kliknij albo Enter, aby wpisać T20').className.split(' ')).toContain('pointer-coarse:hidden');
      expect(screen.getByText('Dotknij, aby wpisać T20').className.split(' ')).toEqual(expect.arrayContaining(['hidden', 'pointer-coarse:inline']));
    });

    it('keeps the hint on one truncated line', () => {
      renderPanel();
      const line = screen.getByText('Kliknij albo Enter, aby wpisać T20').parentElement as HTMLElement;
      expect(line.className.split(' ')).toEqual(expect.arrayContaining(['truncate', 'text-sm', 'leading-tight']));
    });

    it('calls onCheckout with the first dart on a click', () => {
      const { card, onCheckoutHit } = renderPanel();
      fireEvent.click(card);
      expect(onCheckoutHit).toHaveBeenCalledExactlyOnceWith({ segment: 20, multiplier: 3 });
    });

    it('is disabled with checkoutDisabled', () => {
      const { card, onCheckoutHit } = renderPanel(true);
      expect(card.disabled).toBe(true);
      fireEvent.click(card);
      expect(onCheckoutHit).not.toHaveBeenCalled();
    });

    it('keeps the card 80 px high from lg', () => {
      const { card } = renderPanel();
      expect(card.className.split(' ')).toContain('lg:h-20');
    });

    it('keeps the placeholder without a route out of the buttons', () => {
      const noRoute = snapshot({ currentPlayerId: 'p1', players: [player('p1', 'Anna', { remaining: 301, legsWon: 0 }), player('p2', 'Bartek', { legsWon: 0 })] });
      const { container } = render(<TurnPanel {...review} state={noRoute} lastTurn={null} busy={false} onUndo={onUndo} onCheckout={onCheckout} checkoutDisabled={false} />);
      const placeholder = container.querySelector('[aria-hidden="true"].invisible');
      expect(placeholder?.tagName).toBe('DIV');
      expect(placeholder?.className.split(' ')).toContain('lg:h-20');
      expect(screen.queryByRole('button', { name: /Zamknięcie/ })).toBeNull();
      expect(screen.queryByText(/aby wpisać/)).toBeNull();
    });

    it('gives Cofnij a Backspace badge without changing its name', () => {
      renderPanel();
      const undo = screen.getByRole('button', { name: 'Cofnij' });
      expect(undo.getAttribute('aria-keyshortcuts')).toBe('Backspace');
      expect(undo.className.split(' ')).toContain('relative');
      const badge = undo.querySelector('span[aria-hidden="true"]');
      expect(badge?.textContent).toBe('Backspace');
      expect(badge?.className.split(' ')).toEqual(expect.arrayContaining(['absolute', 'hidden', 'lg:block']));
    });
  });

  describe('review', () => {
    const state = snapshot({
      currentPlayerId: 'p1',
      players: [player('p1', 'Anna', { remaining: 80, legsWon: 0 }), player('p2', 'Bartek', { legsWon: 0 })],
      currentDarts: [{ segment: 20, multiplier: 1 }],
      lastTurnThrows: [
        reviewedThrow('t1'),
        reviewedThrow('t2', { status: 'pending', scoring: 'waiting', value: { segment: 20, multiplier: 3 } }),
        reviewedThrow('t3', { scoring: 'waiting', value: { segment: 5, multiplier: 1 } }),
      ],
      awaitingReview: true,
    });

    function renderReview(props: { selectedPendingId?: string | null; flagDisabled?: boolean } = {}) {
      const onSelectPending = vi.fn<(throwId: string) => void>();
      const onFlag = vi.fn<() => void>();
      render(
        <TurnPanel
          state={state}
          lastTurn={null}
          busy={false}
          onUndo={onUndo}
          onCheckout={onCheckout}
          checkoutDisabled={false}
          selectedPendingId={props.selectedPendingId ?? 't2'}
          onSelectPending={onSelectPending}
          onFlag={onFlag}
          flagDisabled={props.flagDisabled ?? false}
        />,
      );
      return { onSelectPending, onFlag };
    }

    it('shows the pending throw as a pressed button with an icon and text', () => {
      const { onSelectPending } = renderReview();
      const button = within(screen.getByLabelText('Rzutka 2')).getByRole('button', { name: /Do potwierdzenia/ });
      expect(button.getAttribute('aria-pressed')).toBe('true');
      expect(button.textContent).toContain('T20');
      expect(button.querySelector('svg')).not.toBeNull();
      fireEvent.click(button);
      expect(onSelectPending).toHaveBeenCalledExactlyOnceWith('t2');
    });

    it('leaves a pending throw unpressed when another one is selected', () => {
      renderReview({ selectedPendingId: 'other' });
      expect(within(screen.getByLabelText('Rzutka 2')).getByRole('button').getAttribute('aria-pressed')).toBe('false');
    });

    it('shows a counted throw with points and a waiting one with czeka', () => {
      renderReview();
      expect(screen.getByLabelText('Rzutka 1').textContent).toBe('Rzutka 12020');
      expect(screen.getByLabelText('Rzutka 3').textContent).toBe('Rzutka 35czeka');
      expect(screen.queryByText('czeka na rzutkę')).toBeNull();
    });

    it('shows the waiting turn instead of a total and no checkout', () => {
      renderReview();
      const total = screen.getByText('Tura czeka na weryfikację');
      expect(total.querySelector('svg')).not.toBeNull();
      expect(total.parentElement?.textContent).toBe('Suma turyTura czeka na weryfikację');
      expect(screen.queryByText('Zamknięcie')).toBeNull();
      expect(screen.queryByText(/do wygrania lega/)).toBeNull();
    });

    it('hides the dart counter once the turn is full', () => {
      renderReview();
      expect(screen.queryByText(/z 3$/)).toBeNull();
      expect(screen.getByText('Anna rzuca')).toBeTruthy();
    });

    it('counts the stored throws, not only the counted darts', () => {
      render(
        <TurnPanel
          state={{ ...state, lastTurnThrows: state.lastTurnThrows.slice(0, 2) }}
          lastTurn={null}
          busy={false}
          onUndo={onUndo}
          onCheckout={onCheckout}
          checkoutDisabled={false}
          selectedPendingId="t2"
          onSelectPending={() => undefined}
          onFlag={() => undefined}
          flagDisabled={false}
        />,
      );
      expect(screen.getByText('Rzutka 3 z 3')).toBeTruthy();
      expect(screen.getByLabelText('Rzutka 3').textContent).toBe('Rzutka 3\u00a0\u00a0');
    });
  });

  describe('Do weryfikacji', () => {
    function flagButton(flagDisabled: boolean, busy = false) {
      const onFlag = vi.fn<() => void>();
      render(<TurnPanel {...review} state={snapshot()} lastTurn={null} busy={busy} onUndo={onUndo} onCheckout={onCheckout} checkoutDisabled={false} onFlag={onFlag} flagDisabled={flagDisabled} />);
      return { button: screen.getByRole('button', { name: 'Do weryfikacji' }) as HTMLButtonElement, onFlag };
    }

    it('calls onFlag without a Wkrótce label', () => {
      const { button, onFlag } = flagButton(false);
      expect(button.disabled).toBe(false);
      expect(button.textContent).not.toContain('Wkrótce');
      fireEvent.click(button);
      expect(onFlag).toHaveBeenCalledOnce();
    });

    it('is disabled with flagDisabled', () => {
      expect(flagButton(true).button.disabled).toBe(true);
    });

    it('is disabled while a command is in flight', () => {
      expect(flagButton(false, true).button.disabled).toBe(true);
    });

    it('keeps Nowa runda as Wkrótce', () => {
      flagButton(false);
      expect(screen.getByRole('button', { name: /Nowa runda/ }).textContent).toContain('Wkrótce');
    });
  });
});
