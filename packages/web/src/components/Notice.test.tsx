import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Notice } from './Notice';

describe('Notice', () => {
  it('writes the message in the text color with an accent icon', () => {
    render(<Notice text="Nie udało się wczytać historii" />);
    const text = screen.getByText('Nie udało się wczytać historii');
    const classes = text.className.split(' ');
    expect(classes).toContain('text-(--color-text)');
    expect(classes).not.toContain('text-(--color-accent)');
    expect(text.querySelector('svg')?.getAttribute('class')).toContain('text-(--color-accent)');
  });
});
