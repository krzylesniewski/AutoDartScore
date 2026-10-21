import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AvatarColorPicker } from './AvatarColorPicker';

function radios(): HTMLInputElement[] {
  return screen.getAllByRole('radio') as HTMLInputElement[];
}

describe('AvatarColorPicker', () => {
  it('renders 16 round swatches of at least 44 px in a named group', () => {
    render(<AvatarColorPicker value={null} onChange={vi.fn()} name="Anna" avatar="" />);
    const group = screen.getByRole('group', { name: 'Kolor' });
    expect(within(group).getAllByRole('radio')).toHaveLength(16);
    radios().forEach((radio, index) => {
      const swatch = radio.nextElementSibling;
      expect(swatch?.classList).toContain('size-11');
      expect(swatch?.classList).toContain('rounded-full');
      expect(swatch?.classList).toContain(`bg-(--color-avatar-${index + 1})`);
    });
  });

  it('wraps into 4 columns and uses 8 only when they fit', () => {
    render(<AvatarColorPicker value={null} onChange={vi.fn()} name="Anna" avatar="" />);
    const grid = radios()[0]?.closest('label')?.parentElement;
    expect(grid?.classList).toContain('grid-cols-[repeat(4,2.75rem)]');
    expect(grid?.classList).toContain('@min-[422px]:grid-cols-[repeat(8,2.75rem)]');
    expect(grid?.closest('fieldset')?.classList).toContain('@container');
  });

  it('marks the checked swatch with a ring and a check mark', () => {
    render(<AvatarColorPicker value={7} onChange={vi.fn()} name="Anna" avatar="🦊" />);
    const checked = radios().filter((radio) => radio.checked);
    expect(checked.map((radio) => radio.getAttribute('aria-label'))).toEqual(['Różowy']);
    expect(checked[0]?.nextElementSibling?.textContent).toBe('✓');
    expect(checked[0]?.nextElementSibling?.classList).toContain('peer-checked:ring-3');
    expect(radios().filter((radio) => radio.nextElementSibling?.textContent === '✓')).toHaveLength(1);
  });

  it('previews the avatar in the chosen color', () => {
    render(<AvatarColorPicker value={7} onChange={vi.fn()} name="Anna" avatar="🦊" />);
    expect(screen.getByText('🦊').classList).toContain('bg-(--color-avatar-7)');
    expect(screen.queryByText('Bez wyboru kolor zostanie dobrany automatycznie.')).toBeNull();
  });

  it('previews on a neutral surface and explains the automatic color without a choice', () => {
    render(<AvatarColorPicker value={null} onChange={vi.fn()} name="anna" avatar="" />);
    const preview = screen.getByText('A');
    expect(preview.classList).toContain('bg-(--color-surface-button)');
    expect(preview.classList).toContain('text-(--color-text)');
    expect(screen.getByText('Bez wyboru kolor zostanie dobrany automatycznie.')).toBeTruthy();
  });

  it('reports the chosen color number', () => {
    const onChange = vi.fn();
    render(<AvatarColorPicker value={null} onChange={onChange} name="Anna" avatar="" />);
    fireEvent.click(screen.getByRole('radio', { name: 'Łososiowy' }));
    expect(onChange).toHaveBeenCalledWith(16);
  });
});
