import { isSingleEmoji } from '@autoscore/schema';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AVATAR_EMOJI, AVATAR_EMOJI_GROUPS } from '../game/avatar-emoji';
import { AvatarEmojiPicker } from './AvatarEmojiPicker';

function Harness({ initial = '', onChange = vi.fn() }: { initial?: string; onChange?: (avatar: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <AvatarEmojiPicker
        value={value}
        onChange={(avatar) => {
          setValue(avatar);
          onChange(avatar);
        }}
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

const value = () => screen.getByTestId('value').textContent;
const custom = () => screen.getByRole('textbox', { name: 'Inne emoji' });

describe('avatar emoji set', () => {
  it('has three groups of 10 distinct single emoji', () => {
    expect(AVATAR_EMOJI_GROUPS.map((group) => group.length)).toEqual([10, 10, 10]);
    expect(new Set(AVATAR_EMOJI).size).toBe(30);
    expect(AVATAR_EMOJI.every(isSingleEmoji)).toBe(true);
  });
});

describe('AvatarEmojiPicker', () => {
  it('groups the emoji under their names in one radio group with "Bez emoji" first', () => {
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'Avatar (emoji)' })).toBeTruthy();
    for (const name of ['Film i gry', 'Sport', 'Postaci']) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(31);
    expect(new Set(radios.map((radio) => radio.getAttribute('name'))).size).toBe(1);
    expect(radios[0]?.getAttribute('value')).toBe('');
    expect((radios[0] as HTMLInputElement).checked).toBe(true);
  });

  it('picks an emoji and clears it with "Bez emoji"', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: '👾' }));
    expect(value()).toBe('👾');
    expect((screen.getByRole('radio', { name: '👾' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: /Bez emoji/ }));
    expect(value()).toBe('');
  });

  it('accepts one custom emoji and unchecks the grid', () => {
    render(<Harness initial="🎯" />);
    fireEvent.change(custom(), { target: { value: '🐙' } });
    expect(value()).toBe('🐙');
    expect(screen.getAllByRole('radio').some((radio) => (radio as HTMLInputElement).checked)).toBe(false);
    expect(custom().getAttribute('aria-invalid')).toBe('false');
  });

  it('rejects text in the custom field and keeps the last emoji', () => {
    const onChange = vi.fn();
    render(<Harness initial="🎯" onChange={onChange} />);
    fireEvent.change(custom(), { target: { value: 'abc' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(value()).toBe('🎯');
    const error = screen.getByText('Wpisz jedno emoji, np. 🐙');
    expect(custom().getAttribute('aria-invalid')).toBe('true');
    expect(custom().getAttribute('aria-describedby')).toBe(error.id);
  });

  it('shows a saved emoji from outside the grid in the custom field', () => {
    render(<Harness initial="🐙" />);
    expect((custom() as HTMLInputElement).value).toBe('🐙');
    fireEvent.change(custom(), { target: { value: '' } });
    expect(value()).toBe('');
  });

  it('clears the custom field after picking from the grid', () => {
    render(<Harness initial="🐙" />);
    fireEvent.click(screen.getByRole('radio', { name: '🎯' }));
    expect(value()).toBe('🎯');
    expect((custom() as HTMLInputElement).value).toBe('');
  });
});
