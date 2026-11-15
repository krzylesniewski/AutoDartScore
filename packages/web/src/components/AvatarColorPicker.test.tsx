import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AvatarColorPicker } from './AvatarColorPicker';

function radios(): HTMLInputElement[] {
  return screen.getAllByRole('radio') as HTMLInputElement[];
}

describe('AvatarColorPicker', () => {
  it('renders 16 named color radios in a named group', () => {
    render(<AvatarColorPicker value={null} onChange={vi.fn()} name="Anna" avatar="" />);
    const group = screen.getByRole('group', { name: 'Kolor' });
    expect(within(group).getAllByRole('radio')).toHaveLength(16);
    expect(radios().every((radio) => radio.getAttribute('aria-label'))).toBe(true);
    expect(radios().some((radio) => radio.checked)).toBe(false);
  });

  it('checks the chosen swatch and shows a check mark on it only', () => {
    render(<AvatarColorPicker value={7} onChange={vi.fn()} name="Anna" avatar="🦊" />);
    const checked = radios().filter((radio) => radio.checked);
    expect(checked.map((radio) => radio.getAttribute('aria-label'))).toEqual(['Różowy']);
    expect(screen.getAllByText('✓')).toHaveLength(1);
    expect(checked[0]?.closest('label')?.textContent).toBe('✓');
  });

  it('previews the avatar in the chosen color', () => {
    render(<AvatarColorPicker value={7} onChange={vi.fn()} name="Anna" avatar="🦊" />);
    // Stały kolor awatara gracza widać tylko w klasie tokenu.
    expect(screen.getByText('🦊').className).toContain('bg-(--color-avatar-7)');
    expect(screen.queryByText('Bez wyboru kolor zostanie dobrany automatycznie.')).toBeNull();
  });

  it('previews the initial and explains the automatic color without a choice', () => {
    render(<AvatarColorPicker value={null} onChange={vi.fn()} name="anna" avatar="" />);
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('Bez wyboru kolor zostanie dobrany automatycznie.')).toBeTruthy();
  });

  it('reports the chosen color number', () => {
    const onChange = vi.fn();
    render(<AvatarColorPicker value={null} onChange={onChange} name="Anna" avatar="" />);
    fireEvent.click(screen.getByRole('radio', { name: 'Łososiowy' }));
    expect(onChange).toHaveBeenCalledWith(16);
  });
});
