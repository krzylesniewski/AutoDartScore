import { expect, type Locator, type Page } from '@playwright/test';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Tylko dokument i main każdego ekranu. Wewnętrzne kontenery mogą przewijać się w poziomie same.
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const measured = await page.evaluate(() => {
    const scrolling = document.scrollingElement;
    const mains = Array.from(document.querySelectorAll('main'));
    return [
      ...(scrolling ? [{ name: 'document.scrollingElement', scrollWidth: scrolling.scrollWidth, clientWidth: scrolling.clientWidth }] : []),
      ...mains.map((main, index) => ({ name: `main #${index + 1}`, scrollWidth: main.scrollWidth, clientWidth: main.clientWidth })),
    ];
  });
  for (const { name, scrollWidth, clientWidth } of measured) {
    expect(
      scrollWidth - clientWidth,
      `${name} at ${page.url()}: scrollWidth ${scrollWidth}, clientWidth ${clientWidth}`,
    ).toBeLessThanOrEqual(1);
  }
}

export function keypadRegion(page: Page): Locator {
  return page.getByRole('region', { name: 'Klawiatura rzutek' });
}

export async function keypadBox(page: Page): Promise<Box> {
  return boxOf(keypadRegion(page));
}

export async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error(`${locator.toString()} has no bounding box`);
  }
  return box;
}

export function expectNoOverlap(first: Box, second: Box): void {
  const where = `boxes ${JSON.stringify(first)} and ${JSON.stringify(second)}`;
  const apart =
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y;
  expect(apart, where).toBe(true);
}

export async function expectInViewport(box: Box, page: Page): Promise<void> {
  const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const where = `box ${JSON.stringify(box)} in viewport ${viewport.width}×${viewport.height}`;
  expect(box.x, where).toBeGreaterThanOrEqual(0);
  expect(box.y, where).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, where).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height, where).toBeLessThanOrEqual(viewport.height);
}

export function expectSameBox(actual: Box, expected: Box): void {
  const where = `box ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`;
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(actual[key] - expected[key]), `${key}: ${where}`).toBeLessThanOrEqual(1);
  }
}
