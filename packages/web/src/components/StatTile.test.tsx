import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BustIcon } from './icons';
import { StatTile } from './StatTile';

describe('StatTile', () => {
  it('keeps the label and the value together in a description list', () => {
    render(<StatTile label="Rzutek w legu" value={23} />);
    const term = screen.getByRole('term');
    expect(term.textContent).toBe('Rzutek w legu');
    expect(screen.getByRole('definition').textContent).toBe('23');
  });

  it('shows the detail after the value', () => {
    render(<StatTile label="Najwyższa tura" value={100} detail="Bartek" />);
    expect(screen.getByRole('definition').textContent).toBe('100Bartek');
  });

  it('hides the icon from screen readers and puts it before the value', () => {
    render(<StatTile label="Busty" value={1} icon={<BustIcon />} />);
    const value = screen.getByRole('definition');
    const icon = value.querySelector('svg') as SVGElement;
    expect(icon.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(icon.compareDocumentPosition(screen.getByText('1')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(value.textContent).toBe('1');
  });
});
