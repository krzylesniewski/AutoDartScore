import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VoiceToggle } from './VoiceToggle';

describe('VoiceToggle', () => {
  it('keeps the bare name, aria-pressed and the visible state without a variant', () => {
    const onChange = vi.fn();
    render(<VoiceToggle enabled onChange={onChange} />);
    const button = screen.getByRole('button', { name: 'Głos' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.hasAttribute('aria-label')).toBe(false);
    expect(button.textContent).toContain('włączony');
    button.click();
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it.each([true, false])('keeps the name and aria-pressed=%s with variant="icon"', (enabled) => {
    const onChange = vi.fn();
    render(<VoiceToggle enabled={enabled} onChange={onChange} variant="icon" />);
    const button = screen.getByRole('button', { name: 'Głos' });
    expect(button.getAttribute('aria-pressed')).toBe(String(enabled));
    expect(button.hasAttribute('aria-label')).toBe(false);
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
    button.click();
    expect(onChange).toHaveBeenCalledWith(!enabled);
  });

  it('shows the card state in a pill hidden from screen readers, with a check mark only when on', () => {
    const { rerender } = render(<VoiceToggle enabled onChange={vi.fn()} variant="card" />);
    const button = screen.getByRole('button', { name: 'Głos' });
    const onPill = within(button).getByText('włączony');
    expect(onPill.getAttribute('aria-hidden')).toBe('true');
    expect(onPill.querySelector('svg')).not.toBeNull();

    rerender(<VoiceToggle enabled={false} onChange={vi.fn()} variant="card" />);
    const offPill = within(button).getByText('wyłączony');
    expect(offPill.getAttribute('aria-hidden')).toBe('true');
    expect(offPill.querySelector('svg')).toBeNull();
  });
});
