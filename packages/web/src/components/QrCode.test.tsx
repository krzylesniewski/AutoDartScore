import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { qrPath } from '../game/qr-path';
import { QrCode } from './QrCode';

const URL = 'http://192.168.1.20:5173/#/t/t1';

describe('QrCode', () => {
  it('renders a named image with the code size as the view box and one path of dark modules', () => {
    render(<QrCode value={URL} />);
    const svg = screen.getByRole('img', { name: 'Kod QR publicznego linku' });
    const { size, path } = qrPath(URL);
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${size} ${size}`);
    expect(svg.getAttribute('shape-rendering')).toBe('crispEdges');
    expect(svg.querySelectorAll('rect')).toHaveLength(1);
    const paths = svg.querySelectorAll('path');
    expect(paths).toHaveLength(1);
    expect(paths[0]?.getAttribute('d')).toBe(path);
  });
});
