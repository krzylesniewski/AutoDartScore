import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppMark } from './AppMark';

describe('AppMark', () => {
  it('renders a hidden mark with four rings and no hard-coded colors', () => {
    const { container } = render(<AppMark className="size-8" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('circle')).toHaveLength(4);
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
