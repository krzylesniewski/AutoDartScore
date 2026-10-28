import { describe, expect, it } from 'vitest';
import { clientToImagePoint } from './image-point';

const natural = { width: 1920, height: 1080 };
const rect = { left: 100, top: 50, width: 960, height: 540 };

describe('clientToImagePoint', () => {
  it('scales a position on a smaller image to natural pixels', () => {
    expect(clientToImagePoint(100, 50, rect, natural)).toEqual({ x: 0, y: 0 });
    expect(clientToImagePoint(580, 320, rect, natural)).toEqual({ x: 960, y: 540 });
    expect(clientToImagePoint(1060, 590, rect, natural)).toEqual({ x: 1920, y: 1080 });
  });

  it('rounds to 0.1 px', () => {
    expect(clientToImagePoint(100.123, 50.456, rect, natural)).toEqual({ x: 0.2, y: 0.9 });
  });

  it('clamps a position outside the image to its edge', () => {
    expect(clientToImagePoint(40, 20, rect, natural)).toEqual({ x: 0, y: 0 });
    expect(clientToImagePoint(2000, 900, rect, natural)).toEqual({ x: 1920, y: 1080 });
  });

  it('scales each axis on its own', () => {
    expect(clientToImagePoint(250, 125, { left: 0, top: 0, width: 500, height: 250 }, { width: 1000, height: 1000 })).toEqual({ x: 500, y: 500 });
  });
});
