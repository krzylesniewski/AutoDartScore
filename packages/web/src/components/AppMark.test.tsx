import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppMark } from './AppMark';

describe('AppMark', () => {
  it('renders a hidden mark with four rings filled from tokens', () => {
    const { container } = render(<AppMark className="size-8" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('class')).toContain('size-8');
    const fills = Array.from(container.querySelectorAll('circle'), (circle) => circle.getAttribute('class'));
    expect(fills).toEqual(['fill-(--color-accent)', 'fill-(--color-bg)', 'fill-(--color-text)', 'fill-(--color-accent)']);
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
