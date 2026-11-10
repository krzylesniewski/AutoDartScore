import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CornerRings } from './CornerRings';

describe('CornerRings', () => {
  it('draws three decorative circles hidden from screen readers and clicks', () => {
    const { container } = render(<CornerRings className="-top-15 -right-15 size-50" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.classList).toContain('pointer-events-none');
    expect(svg?.classList).toContain('size-50');
    expect(svg?.querySelectorAll('circle')).toHaveLength(3);
  });
});
