import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EffectsToggle } from './EffectsToggle';

describe('EffectsToggle', () => {
  it('keeps the bare name, aria-pressed and the visible state without a variant', () => {
    const onChange = vi.fn();
    render(<EffectsToggle enabled onChange={onChange} />);
    const button = screen.getByRole('button', { name: 'Efekty dźwiękowe' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.hasAttribute('aria-label')).toBe(false);
    expect(button.textContent).toContain('włączone');
    button.click();
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it.each([true, false])('keeps the name and aria-pressed=%s with variant="icon"', (enabled) => {
    const onChange = vi.fn();
    render(<EffectsToggle enabled={enabled} onChange={onChange} variant="icon" />);
    const button = screen.getByRole('button', { name: 'Efekty dźwiękowe' });
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
    render(<EffectsToggle enabled={enabled} onChange={onChange} variant={variant} />);
    const button = screen.getByRole('button', { name: 'Efekty dźwiękowe' });
    expect(button.getAttribute('aria-pressed')).toBe(String(enabled));
    expect(button.hasAttribute('aria-label')).toBe(false);
    expect(button.textContent).toContain(enabled ? 'włączone' : 'wyłączone');
    button.click();
    expect(onChange).toHaveBeenCalledWith(!enabled);
  });
});
