import { DEFAULT_CAMERA_ID, type CameraCalibration, type ImagePoint } from '@autoscore/schema';
import { useEffect, useId, useMemo, useState } from 'react';
import { getCameraCalibration, getCameraSnapshot, saveCameraCalibration } from '../api/client';
import { boardOverlay } from '../camera/board-overlay';
import { calibrationFileContent } from '../camera/calibration-file';
import { CALIBRATION_STEPS, EMPTY_POINTS, nextStep, placePoint, toCalibration, type CalibrationPoints, type ImageSize } from '../camera/calibration-steps';
import { AppNav } from '../components/AppNav';
import { CalibrationGuide } from '../components/CalibrationGuide';
import { CalibrationImage } from '../components/CalibrationImage';
import { CheckIcon } from '../components/icons';
import { Notice } from '../components/Notice';
import { pl } from '../i18n/pl';

type Source = 'camera' | 'file';

type CameraFrame =
  | { status: 'loading' }
  | { status: 'ready'; snapshot: Blob; saved: CameraCalibration | null }
  | { status: 'missing' }
  | { status: 'error' };

interface Draft {
  readonly size: ImageSize | null;
  readonly points: CalibrationPoints;
  readonly active: number | null;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const EMPTY_DRAFT: Draft = { size: null, points: EMPTY_POINTS, active: 0 };

const sectionTitle = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';
const button =
  'flex min-h-12 items-center justify-center gap-2 rounded-(--radius-chip) border-(length:--border-width) px-4 font-display text-xl font-semibold disabled:opacity-40';
const secondary = `${button} border-(--color-border-strong) bg-(--color-surface-button) text-(--color-text)`;
const primary = `${button} border-(--color-accent) bg-(--color-accent) text-(--color-on-accent)`;

function choiceStyle(selected: boolean): string {
  return `${button} flex-1 ${selected ? 'border-(--color-text) bg-(--color-text) text-(--color-text-inverse)' : 'border-(--color-border-strong) bg-(--color-surface) text-(--color-text)'}`;
}

// Adres obiektu żyje tak długo jak Blob w stanie: wymiana i odmontowanie go zwalniają.
function useObjectUrl(source: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (source === null) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(source);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [source]);
  return url;
}

function sameSize(a: ImageSize | null, b: ImageSize): boolean {
  return a !== null && a.width === b.width && a.height === b.height;
}

function downloadFile(name: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Część przeglądarek zaczyna pobieranie dopiero po powrocie do pętli zdarzeń.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function CalibrationScreen() {
  const ids = useId();
  const [source, setSource] = useState<Source>('camera');
  const [frame, setFrame] = useState<CameraFrame>({ status: 'loading' });
  const [refreshes, setRefreshes] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [save, setSave] = useState<SaveState>('idle');

  useEffect(() => {
    if (source !== 'camera') {
      return;
    }
    let cancelled = false;
    setFrame({ status: 'loading' });
    Promise.all([getCameraSnapshot(DEFAULT_CAMERA_ID), getCameraCalibration(DEFAULT_CAMERA_ID)]).then(
      ([snapshot, saved]) => {
        if (!cancelled) {
          setFrame(snapshot === null ? { status: 'missing' } : { status: 'ready', snapshot, saved });
        }
      },
      () => {
        if (!cancelled) {
          setFrame({ status: 'error' });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, refreshes]);

  const image = source === 'camera' ? (frame.status === 'ready' ? frame.snapshot : null) : file;
  const imageUrl = useObjectUrl(image);
  const saved = source === 'camera' && frame.status === 'ready' ? frame.saved : null;

  const calibration = useMemo(() => (draft.size ? toCalibration(draft.points, draft.size) : null), [draft]);
  const overlay = useMemo(() => (calibration ? boardOverlay(calibration) : null), [calibration]);
  const ready = calibration !== null && overlay !== null;
  const allSet = draft.points.every((point) => point !== null);
  const activeStep = draft.active === null ? null : CALIBRATION_STEPS[draft.active];

  function changeSource(next: Source): void {
    if (next === source) {
      return;
    }
    setSource(next);
    setDraft(EMPTY_DRAFT);
    setImageFailed(false);
    setSave('idle');
  }

  function changeDraft(update: (current: Draft) => Draft): void {
    setDraft(update);
    setSave('idle');
  }

  // Ten sam rozmiar (odświeżona klatka, kolejny plik z tej samej kamery) zostawia punkty. Inny je czyści.
  function handleLoad(size: ImageSize): void {
    setImageFailed(false);
    changeDraft((current) => {
      if (sameSize(current.size, size)) {
        return current;
      }
      const points = saved && sameSize({ width: saved.imageWidth, height: saved.imageHeight }, size) ? saved.points : EMPTY_POINTS;
      return { size, points, active: nextStep(points, points.length - 1) };
    });
  }

  function place(point: ImagePoint): void {
    changeDraft((current) => {
      if (current.active === null) {
        return current;
      }
      const points = placePoint(current.points, current.active, point);
      return { ...current, points, active: nextStep(points, current.active) };
    });
  }

  function pickFile(next: File | undefined): void {
    if (next) {
      setFile(next);
      setImageFailed(false);
    }
  }

  async function saveCalibration(): Promise<void> {
    if (!calibration) {
      return;
    }
    setSave('saving');
    try {
      await saveCameraCalibration(DEFAULT_CAMERA_ID, calibration);
      setSave('saved');
    } catch {
      setSave('error');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <AppNav current="settings" />
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-4 pt-4 pb-6 sm:px-8 lg:px-12 lg:pt-6 lg:pb-8">
        <div className="flex flex-col gap-1.5">
          <a href="#/settings" className="flex min-h-11 w-fit items-center font-display text-lg text-(--color-text-muted) underline-offset-4 hover:underline">
            ← {pl.calibrationBack}
          </a>
          <h1 className="font-display text-[length:clamp(2.25rem,9vw,3.5rem)] leading-none font-bold uppercase">{pl.calibration}</h1>
          <p className="text-[17px] text-(--color-text-muted)">{pl.calibrationSubtitle}</p>
        </div>
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
          <div className="flex min-w-0 flex-col gap-3">
            <div role="group" aria-label={pl.calibrationSource} className="flex gap-2.5">
              <button type="button" aria-pressed={source === 'camera'} onClick={() => changeSource('camera')} className={choiceStyle(source === 'camera')}>
                {pl.calibrationSourceCamera}
              </button>
              <button type="button" aria-pressed={source === 'file'} onClick={() => changeSource('file')} className={choiceStyle(source === 'file')}>
                {pl.calibrationSourceFile}
              </button>
            </div>
            {source === 'camera' ? (
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setRefreshes((count) => count + 1)} disabled={frame.status === 'loading'} className={secondary}>
                  {pl.calibrationRefresh}
                </button>
                {frame.status === 'loading' && <p className="text-(--color-text-muted)">{pl.calibrationLoading}</p>}
              </div>
            ) : (
              <label className={`${secondary} w-fit cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--color-text)`}>
                <input type="file" accept="image/jpeg" className="sr-only" onChange={(event) => pickFile(event.target.files?.[0])} />
                {pl.calibrationPickFile}
              </label>
            )}
            {source === 'camera' && frame.status === 'missing' && <Notice text={pl.calibrationNoSnapshot} />}
            {source === 'camera' && frame.status === 'error' && (
              <div role="alert">
                <Notice text={pl.calibrationLoadFailed} />
              </div>
            )}
            {source === 'file' && file === null && <p className="text-(--color-text-muted)">{pl.calibrationNoFile}</p>}
            {imageFailed && (
              <div role="alert">
                <Notice text={pl.calibrationImageFailed} />
              </div>
            )}
            {imageUrl && (
              <CalibrationImage
                key={imageUrl}
                src={imageUrl}
                alt={source === 'camera' ? pl.calibrationImageCamera : pl.calibrationImageFile}
                naturalSize={draft.size}
                points={draft.points}
                overlay={ready ? overlay : null}
                canPlace={draft.size !== null && draft.active !== null}
                onLoad={handleLoad}
                onError={() => setImageFailed(true)}
                onPlace={place}
              />
            )}
          </div>
          <div className="flex flex-col gap-5">
            <section aria-labelledby={`${ids}-steps`} className="flex flex-col gap-2.5">
              <h2 id={`${ids}-steps`} className={sectionTitle}>
                {pl.calibrationSteps}
              </h2>
              <ol className="grid grid-cols-2 gap-2.5">
                {CALIBRATION_STEPS.map((step, index) => {
                  const placed = draft.points[index] !== null;
                  const pressed = draft.active === index;
                  return (
                    <li key={index}>
                      <button
                        type="button"
                        aria-pressed={pressed}
                        onClick={() => changeDraft((current) => ({ ...current, active: index }))}
                        className={`flex min-h-14 w-full flex-col items-start rounded-(--radius-card) border-(length:--border-width) px-3 py-2 text-left ${pressed ? 'border-(--color-text) bg-(--color-surface-active)' : 'border-(--color-border-strong) bg-(--color-surface)'}`}
                      >
                        <span className="font-display text-lg leading-tight font-semibold">
                          {pl.calibrationStep(index + 1)} · {pl.calibrationStepSegments(step.segments[0], step.segments[1])}
                        </span>
                        <span className={`flex items-center gap-1 text-sm ${placed ? 'text-(--color-text)' : 'text-(--color-text-muted)'}`}>
                          {placed && <CheckIcon />}
                          {placed ? pl.calibrationPointSet : pl.calibrationPointMissing}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
            <div className="flex items-start gap-4">
              <CalibrationGuide active={draft.active} />
              <div className="flex min-w-0 flex-col gap-2">
                <p className="font-display text-xl leading-snug font-semibold">
                  {activeStep ? pl.calibrationInstruction(activeStep.segments[0], activeStep.segments[1]) : pl.calibrationAllSet}
                </p>
                <p className="text-sm text-(--color-text-muted)">{pl.calibrationGuideNote}</p>
              </div>
            </div>
            {allSet && !ready && <Notice text={pl.calibrationInvalid} />}
            <div className="flex flex-col gap-2.5">
              {source === 'camera' ? (
                <button type="button" onClick={() => void saveCalibration()} disabled={!ready || save === 'saving'} className={primary}>
                  {pl.calibrationSave}
                </button>
              ) : (
                <button type="button" onClick={() => calibration && downloadFile('calibration.json', calibrationFileContent(calibration))} disabled={!ready} className={primary}>
                  {pl.calibrationDownload}
                </button>
              )}
              <button type="button" onClick={() => changeDraft((current) => ({ ...current, points: EMPTY_POINTS, active: 0 }))} className={secondary}>
                {pl.calibrationReset}
              </button>
              {save === 'saved' && (
                <p role="status" className="flex items-center gap-2 font-display text-lg">
                  <CheckIcon />
                  {pl.calibrationSaved}
                </p>
              )}
              {save === 'error' && (
                <div role="alert">
                  <Notice text={pl.calibrationSaveFailed} />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
