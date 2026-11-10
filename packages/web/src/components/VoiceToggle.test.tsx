import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VoiceToggle } from './VoiceToggle';

const CHIP_CLASS = 'flex min-h-11 items-center gap-2 rounded-(--radius-pill) bg-(--color-surface-soft) px-4 font-display text-lg font-semibold text-(--color-text-sub)';

describe('VoiceToggle', () => {
  it('keeps the chip without a variant', () => {
    render(<VoiceToggle enabled onChange={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Głos' });
    expect(button.getAttribute('class')).toBe(CHIP_CLASS);
    expect(button.querySelector('.lg\\:sr-only')).toBeNull();
  });

  it.each([true, false])('keeps the name and aria-pressed=%s with variant="icon"', (enabled) => {
    const onChange = vi.fn();
    render(<VoiceToggle enabled={enabled} onChange={onChange} variant="icon" />);
    const button = screen.getByRole('button', { name: 'Głos' });
    expect(button.getAttribute('aria-pressed')).toBe(String(enabled));
    expect(button.hasAttribute('aria-label')).toBe(false);
    expect(button.classList.contains('sc-btn--icon')).toBe(true);
    button.click();
    expect(onChange).toHaveBeenCalledWith(!enabled);
  });

  it.each([
    ['chip', true],
    ['chip', false],
    ['card', true],
    ['card', false],
  ] as const)('keeps the bare name and aria-pressed with variant="%s" (enabled: %s)', (variant, enabled) => {
    const onChange = vi.fn();
    render(<VoiceToggle enabled={enabled} onChange={onChange} variant={variant} />);
    const button = screen.getByRole('button', { name: 'Głos' });
    expect(button.getAttribute('aria-pressed')).toBe(String(enabled));
    expect(button.hasAttribute('aria-label')).toBe(false);
    expect(button.textContent).toContain(enabled ? 'włączony' : 'wyłączony');
    expect(button.classList.contains('sc-btn--icon')).toBe(false);
    button.click();
    expect(onChange).toHaveBeenCalledWith(!enabled);
  });

  it('shows the card state in a check pill when on and in an outline pill when off', () => {
    const { rerender } = render(<VoiceToggle enabled onChange={vi.fn()} variant="card" />);
    const button = screen.getByRole('button', { name: 'Głos' });
    expect(button.className.split(' ')).toEqual(expect.arrayContaining(['w-full', 'rounded-(--radius-card)', 'shadow-(--shadow-card)']));
    const onPill = button.querySelector('[aria-hidden="true"].rounded-\\(--radius-pill\\)');
    expect(onPill?.textContent).toBe('włączony');
    expect(onPill?.querySelector('svg')).not.toBeNull();

    rerender(<VoiceToggle enabled={false} onChange={vi.fn()} variant="card" />);
    expect(button.className.split(' ')).toEqual(expect.arrayContaining(['bg-(--color-surface-softer)', 'shadow-(--shadow-inset-line)']));
    const offPill = button.querySelector('[aria-hidden="true"].rounded-\\(--radius-pill\\)');
    expect(offPill?.textContent).toBe('wyłączony');
    expect(offPill?.className.split(' ')).toContain('shadow-(--shadow-outline)');
  });
});
