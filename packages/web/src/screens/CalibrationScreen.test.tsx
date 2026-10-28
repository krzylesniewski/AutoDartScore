import { CameraCalibration } from '@autoscore/schema';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calibrationFileContent } from '../camera/calibration-file';
import { CalibrationScreen } from './CalibrationScreen';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const notFound = () => json(404, { error: 'not_found', message: 'not found' });

// Obraz 1920×1080 pokazany w skali 1/2 od (10, 20).
const natural = { width: 1920, height: 1080 };
const rect = { left: 10, top: 20, width: 960, height: 540 };

// Kolejne punkty kalibracji w pikselach obrazu i odpowiadające im pozycje na ekranie.
const taps = [
  { x: 960, y: 200 },
  { x: 1500, y: 540 },
  { x: 960, y: 900 },
  { x: 420, y: 540 },
];

const saved: CameraCalibration = {
  imageWidth: 1920,
  imageHeight: 1080,
  points: [
    { x: 950, y: 210 },
    { x: 1490, y: 550 },
    { x: 970, y: 890 },
    { x: 430, y: 530 },
  ],
};

interface Call {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
}

let calls: Call[];
let routes: Record<string, () => Response>;
let created: Blob[];

beforeEach(() => {
  calls = [];
  created = [];
  routes = {
    'GET /api/cameras/camera-1/snapshot': () => new Response(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }), { status: 200 }),
    'GET /api/cameras/camera-1/calibration': notFound,
    'PUT /api/cameras/camera-1/calibration': () => json(200, calls.at(-1)?.body),
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      calls.push({ url, method, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined });
      return (routes[`${method} ${url}`] ?? notFound)();
    }),
  );
  // jsdom nie ma createObjectURL ani revokeObjectURL, więc nie da się ich podmienić przez spyOn.
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn((blob: Blob) => {
      created.push(blob);
      return `blob:test/${created.length}`;
    }),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});

afterEach(() => {
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function loadImage(size = natural): Promise<HTMLImageElement> {
  const image = (await screen.findByRole('img', { name: /Klatka z kamery|Zdjęcie tarczy z pliku/ })) as HTMLImageElement;
  vi.spyOn(image, 'getBoundingClientRect').mockReturnValue({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON: () => ({}) });
  Object.defineProperty(image, 'naturalWidth', { value: size.width, configurable: true });
  Object.defineProperty(image, 'naturalHeight', { value: size.height, configurable: true });
  fireEvent.load(image);
  return image;
}

function surface(): HTMLElement {
  return screen.getByTestId('calibration-image');
}

function tap(point: { x: number; y: number }): void {
  const clientX = rect.left + point.x / 2;
  const clientY = rect.top + point.y / 2;
  fireEvent.pointerDown(surface(), { clientX, clientY, pointerId: 1, pointerType: 'touch' });
  fireEvent.pointerUp(surface(), { clientX, clientY, pointerId: 1, pointerType: 'touch' });
}

function step(n: number): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^Punkt ${n} `) });
}

function marker(n: number): { left: string; top: string } | null {
  const element = screen.queryByTestId(`calibration-marker-${n}`);
  return element ? { left: element.style.left, top: element.style.top } : null;
}

function percent(point: { x: number; y: number }): { left: string; top: string } {
  return { left: `${(point.x / natural.width) * 100}%`, top: `${(point.y / natural.height) * 100}%` };
}

function saveButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Zapisz kalibrację' }) as HTMLButtonElement;
}

describe('CalibrationScreen in camera mode', () => {
  it('places the points in step order and moves the active step', async () => {
    render(<CalibrationScreen />);
    await loadImage();
    expect(step(1).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Dotknij zewnętrznej krawędzi pierścienia double na granicy segmentów 5 i 20')).toBeTruthy();

    tap(taps[0]!);
    expect(marker(1)).toEqual(percent(taps[0]!));
    expect(step(1).getAttribute('aria-pressed')).toBe('false');
    expect(step(2).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Dotknij zewnętrznej krawędzi pierścienia double na granicy segmentów 13 i 6')).toBeTruthy();

    tap(taps[1]!);
    tap(taps[2]!);
    expect(step(4).getAttribute('aria-pressed')).toBe('true');
    tap(taps[3]!);
    taps.forEach((point, index) => expect(marker(index + 1)).toEqual(percent(point)));
    expect(screen.getByText('Wszystkie punkty ustawione. Wybierz punkt, żeby go poprawić.')).toBeTruthy();
    expect(screen.getAllByRole('button', { pressed: true }).map((button) => button.textContent)).toEqual(['Kamera']);
    expect(screen.getByTestId('calibration-overlay')).toBeTruthy();
    expect(saveButton().disabled).toBe(false);
  });

  it('shows the step status as text, not only as color', async () => {
    render(<CalibrationScreen />);
    await loadImage();
    expect(within(step(1)).getByText('brak')).toBeTruthy();
    tap(taps[0]!);
    expect(within(step(1)).getByText('ustawiony')).toBeTruthy();
    expect(step(1).querySelector('svg')).not.toBeNull();
    expect(within(step(2)).getByText('brak')).toBeTruthy();
  });

  it('replaces only the selected point', async () => {
    render(<CalibrationScreen />);
    await loadImage();
    taps.forEach(tap);
    fireEvent.click(step(2));
    expect(step(2).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Dotknij zewnętrznej krawędzi pierścienia double na granicy segmentów 13 i 6')).toBeTruthy();

    const corrected = { x: 1480, y: 560 };
    tap(corrected);
    expect(marker(2)).toEqual(percent(corrected));
    expect(marker(1)).toEqual(percent(taps[0]!));
    expect(marker(3)).toEqual(percent(taps[2]!));
    expect(marker(4)).toEqual(percent(taps[3]!));
    expect(step(2).getAttribute('aria-pressed')).toBe('false');
  });

  it('places the point where the pointer is released and shows a loupe while it is down', async () => {
    render(<CalibrationScreen />);
    await loadImage();
    fireEvent.pointerDown(surface(), { clientX: 100, clientY: 100, pointerId: 1, pointerType: 'mouse', button: 0 });
    expect(screen.getByTestId('calibration-loupe')).toBeTruthy();
    fireEvent.pointerMove(surface(), { clientX: 200, clientY: 150, pointerId: 1, pointerType: 'mouse' });
    expect(marker(1)).toBeNull();
    fireEvent.pointerUp(surface(), { clientX: 200, clientY: 150, pointerId: 1, pointerType: 'mouse', button: 0 });
    expect(screen.queryByTestId('calibration-loupe')).toBeNull();
    expect(marker(1)).toEqual(percent({ x: 380, y: 260 }));
  });

  it('does not place a point after a cancelled pointer', async () => {
    render(<CalibrationScreen />);
    await loadImage();
    fireEvent.pointerDown(surface(), { clientX: 100, clientY: 100, pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerCancel(surface(), { pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerUp(surface(), { clientX: 100, clientY: 100, pointerId: 1, pointerType: 'touch' });
    expect(marker(1)).toBeNull();
    expect(screen.queryByTestId('calibration-loupe')).toBeNull();
  });

  it('keeps save disabled with 3 points', async () => {
    render(<CalibrationScreen />);
    await loadImage();
    taps.slice(0, 3).forEach(tap);
    expect(saveButton().disabled).toBe(true);
    expect(screen.queryByTestId('calibration-overlay')).toBeNull();
  });

  it('blocks collinear points with a message', async () => {
    render(<CalibrationScreen />);
    await loadImage();
    [taps[0]!, taps[1]!, { x: 960, y: 540 }, taps[3]!].forEach(tap);
    expect(screen.getByText('Punkty nie tworzą poprawnej kalibracji. Popraw któryś z nich.')).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    expect(screen.queryByTestId('calibration-overlay')).toBeNull();
  });

  it('saves the calibration with PUT', async () => {
    render(<CalibrationScreen />);
    await loadImage();
    taps.forEach(tap);
    fireEvent.click(saveButton());
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Kalibracja zapisana');
    const put = calls.find((call) => call.method === 'PUT');
    expect(put).toEqual({ url: '/api/cameras/camera-1/calibration', method: 'PUT', body: { imageWidth: 1920, imageHeight: 1080, points: taps } });
  });

  it('shows an alert when saving fails', async () => {
    routes['PUT /api/cameras/camera-1/calibration'] = () => json(500, { error: 'internal_error', message: 'Internal server error' });
    render(<CalibrationScreen />);
    await loadImage();
    taps.forEach(tap);
    fireEvent.click(saveButton());
    expect((await screen.findByRole('alert')).textContent).toContain('Nie udało się zapisać kalibracji');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('tells how to send a frame when there is no snapshot', async () => {
    routes['GET /api/cameras/camera-1/snapshot'] = notFound;
    render(<CalibrationScreen />);
    expect(await screen.findByText(/pnpm --filter @autoscore\/vision snapshot/)).toBeTruthy();
    expect(screen.getByText(/przełącz na plik JPEG/)).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Klatka z kamery' })).toBeNull();
  });

  it('prefills the saved calibration for a frame of the same size', async () => {
    routes['GET /api/cameras/camera-1/calibration'] = () => json(200, saved);
    render(<CalibrationScreen />);
    await loadImage();
    saved.points.forEach((point, index) => expect(marker(index + 1)).toEqual(percent(point)));
    expect(screen.getByTestId('calibration-overlay')).toBeTruthy();
    expect(saveButton().disabled).toBe(false);
  });

  it('does not prefill the saved calibration for a frame of another size', async () => {
    routes['GET /api/cameras/camera-1/calibration'] = () => json(200, saved);
    render(<CalibrationScreen />);
    await loadImage({ width: 1280, height: 720 });
    expect(marker(1)).toBeNull();
    expect(step(1).getAttribute('aria-pressed')).toBe('true');
  });

  it('reloads the frame and keeps the points for the same size', async () => {
    render(<CalibrationScreen />);
    await loadImage();
    tap(taps[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Odśwież klatkę' }));
    await loadImage();
    expect(calls.filter((call) => call.url === '/api/cameras/camera-1/snapshot')).toHaveLength(2);
    expect(marker(1)).toEqual(percent(taps[0]!));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test/1');
  });

  it('clears all points with Zacznij od nowa', async () => {
    render(<CalibrationScreen />);
    await loadImage();
    taps.forEach(tap);
    fireEvent.click(screen.getByRole('button', { name: 'Zacznij od nowa' }));
    expect([1, 2, 3, 4].map(marker)).toEqual([null, null, null, null]);
    expect(step(1).getAttribute('aria-pressed')).toBe('true');
    expect(saveButton().disabled).toBe(true);
  });

  it('revokes the snapshot URL on unmount', async () => {
    const { unmount } = render(<CalibrationScreen />);
    await loadImage();
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test/1');
  });
});

describe('CalibrationScreen in file mode', () => {
  it('loads a JPEG and downloads calibration.json without calling the server', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<CalibrationScreen />);
    await screen.findByRole('img', { name: 'Klatka z kamery' });
    fireEvent.click(screen.getByRole('button', { name: 'Plik JPEG' }));
    expect(screen.getByRole('button', { name: 'Plik JPEG' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Zapisz kalibrację' })).toBeNull();

    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], '01-before.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText('Wybierz plik JPEG') as HTMLInputElement;
    expect(input.accept).toBe('image/jpeg');
    fireEvent.change(input, { target: { files: [file] } });
    await loadImage();
    expect(created).toContain(file);

    const download = screen.getByRole('button', { name: 'Pobierz calibration.json' }) as HTMLButtonElement;
    expect(download.disabled).toBe(true);
    taps.forEach(tap);
    expect(download.disabled).toBe(false);
    const callsBefore = calls.length;
    fireEvent.click(download);

    expect(click).toHaveBeenCalledTimes(1);
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe('calibration.json');
    const blob = created.at(-1) as Blob;
    expect(await blob.text()).toBe(calibrationFileContent({ imageWidth: 1920, imageHeight: 1080, points: taps as CameraCalibration['points'] }));
    expect(calls).toHaveLength(callsBefore);
  });

  it('asks for a file before one is picked', async () => {
    render(<CalibrationScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Plik JPEG' }));
    expect(screen.getByText('Wybierz zdjęcie tarczy w formacie JPEG.')).toBeTruthy();
    await act(async () => {});
    expect(screen.queryByRole('img', { name: /Klatka|Zdjęcie/ })).toBeNull();
  });
});
