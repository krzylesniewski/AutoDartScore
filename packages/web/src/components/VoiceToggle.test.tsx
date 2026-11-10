import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VoiceToggle } from './VoiceToggle';

const BASE_CLASS =
  'flex min-h-12 items-center gap-2 rounded-(--radius-chip) border-(length:--border-width) border-(--color-border-strong) bg-(--color-surface-button) px-4 text-(length:--text-button) text-(--color-text-muted)';

describe('VoiceToggle', () => {
  it('keeps the text button without iconFromLg', () => {
    render(<VoiceToggle enabled onChange={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Głos' });
    expect(button.getAttribute('class')).toBe(BASE_CLASS);
    expect(button.querySelector('.lg\\:sr-only')).toBeNull();
  });

  it.each([true, false])('keeps the name and aria-pressed=%s with iconFromLg', (enabled) => {
    const onChange = vi.fn();
    render(<VoiceToggle enabled={enabled} onChange={onChange} iconFromLg />);
    const button = screen.getByRole('button', { name: 'Głos' });
    expect(button.getAttribute('aria-pressed')).toBe(String(enabled));
    expect(button.hasAttribute('aria-label')).toBe(false);
    expect(button.classList.contains('sc-btn--icon')).toBe(true);
    button.click();
    expect(onChange).toHaveBeenCalledWith(!enabled);
  });
});
