// Spike: wykrywanie momentów "ruch, potem spokój" w nagraniu z kamery
// i zapis par klatek "przed" / "po" do dalszej analizy.
//
// Użycie: node spikes/camera/detect-events.mjs <wideo.mp4> [katalog-wyjściowy]
// Wymaga ffmpeg i ffprobe na PATH. Kod jednorazowy, nie produkcyjny.

import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const video = process.argv[2];
if (!video) {
  console.error('Użycie: node spikes/camera/detect-events.mjs <wideo.mp4> [katalog-wyjściowy]');
  process.exit(1);
}
const outDir = process.argv[3] ?? join('spikes/camera/out', basename(video, '.mp4'));

// Analiza w małej rozdzielczości i w odcieniach szarości: tanio i wystarczająco do wykrycia ruchu.
const W = 320;
const H = 180;
const PIXEL_THRESHOLD = 25; // różnica jasności (0-255), od której piksel liczy się jako zmieniony
const MOTION_OFF = 0.0015; // udział zmienionych pikseli względem poprzedniej klatki poniżej tego = spokój
const SETTLE_FRAMES = 3; // tyle kolejnych spokojnych klatek (≈0,6 s przy 5 kl./s) = obraz stabilny
const MIN_EVENT_CHANGE = 0.0005; // stabilny obraz różni się od odniesienia o więcej = zdarzenie
const LONG_MOTION_S = 1.5; // ruch dłuższy niż to = ręka w kadrze (wyjmowanie lotek), nie sam rzut
const LARGE_CHANGE = 0.03; // zmiana przed/po powyżej tego = duża zmiana (start kamery, przesunięcie)

const ptsTimes = execFileSync('ffprobe', [
  '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', video,
], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .map((line) => parseFloat(line)); // linie bywają w formie "0.000000,"

// Rozproszenie zmiany: udział kratek CELL×CELL, w których zmieniło się więcej niż CELL_ACTIVE pikseli.
// Lotka zmienia obraz w jednym miejscu, a ekspozycja i autofocus w całym kadrze.
const CELL = 20;
const CELL_ACTIVE = 0.05;
const GLOBAL_SPREAD = 0.12; // zmiana obejmująca więcej kratek niż to = zmiana globalna (światło, ostrość)
const MIN_ACTIVE_CELLS = 2; // lotka obejmuje co najmniej 2 kratki; mniej = szum (drobny dryf światła)

function changeSpread(a, b) {
  const cols = W / CELL;
  const rows = H / CELL;
  let active = 0;
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      let changed = 0;
      for (let y = cy * CELL; y < (cy + 1) * CELL; y++) {
        for (let x = cx * CELL; x < (cx + 1) * CELL; x++) {
          const i = y * W + x;
          if (Math.abs(a[i] - b[i]) > PIXEL_THRESHOLD) changed++;
        }
      }
      if (changed / (CELL * CELL) > CELL_ACTIVE) active++;
    }
  }
  return { active, spread: active / (cols * rows) };
}

function changedFraction(a, b) {
  let changed = 0;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > PIXEL_THRESHOLD) changed++;
  }
  return changed / a.length;
}

async function readFrames() {
  const ff = spawn('ffmpeg', [
    '-v', 'error', '-i', video, '-fps_mode', 'passthrough',
    '-vf', `scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-',
  ]);
  const size = W * H;
  const frames = [];
  let buf = Buffer.alloc(0);
  for await (const chunk of ff.stdout) {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= size) {
      frames.push(Uint8Array.from(buf.subarray(0, size)));
      buf = buf.subarray(size);
    }
  }
  return frames;
}

const frames = await readFrames();
console.log(`Klatek: ${frames.length}, znaczników czasu: ${ptsTimes.length}`);

// Krzywa ruchu: udział zmienionych pikseli względem poprzedniej klatki.
const motion = frames.map((f, i) => (i === 0 ? 0 : changedFraction(frames[i - 1], f)));

// Porównanie z klatką odniesienia (ostatni stabilny obraz), a nie tylko z poprzednią klatką:
// przy 5 kl./s rzucona lotka pojawia się z klatki na klatkę, więc rzut to jeden skok obrazu, nie dłuższy ruch.
// Zdarzenie = obraz znów stabilny przez SETTLE_FRAMES klatek i trwale różny od odniesienia.
const events = [];
let reference = 0;
let stillRun = 0;
let firstChange = -1; // pierwsza klatka różna od odniesienia
let lastMotion = -1; // ostatnia klatka z ruchem względem poprzedniej
for (let i = 1; i < frames.length; i++) {
  const still = motion[i] < MOTION_OFF;
  if (!still) lastMotion = i;
  stillRun = still ? stillRun + 1 : 0;
  if (firstChange < 0 && changedFraction(frames[reference], frames[i]) >= MIN_EVENT_CHANGE) firstChange = i;
  if (stillRun < SETTLE_FRAMES || firstChange < 0) continue;

  const change = changedFraction(frames[reference], frames[i]);
  if (change >= MIN_EVENT_CHANGE) {
    const motionSeconds = lastMotion >= firstChange ? ptsTimes[lastMotion] - ptsTimes[firstChange] : 0;
    const { active, spread } = changeSpread(frames[reference], frames[i]);
    const kind =
      motionSeconds > LONG_MOTION_S ? 'hand_or_removal'
      : spread > GLOBAL_SPREAD || change > LARGE_CHANGE ? 'global_change'
      : active < MIN_ACTIVE_CELLS ? 'noise'
      : 'candidate_dart';
    events.push({ before: reference, after: i, motionSeconds, change, spread, kind });
  }
  reference = i; // nowy stabilny obraz staje się odniesieniem (także gdy zmiana okazała się pozorna)
  firstChange = -1;
}

mkdirSync(outDir, { recursive: true });

// Dla każdego zdarzenia: pełna klatka "przed", "po" i obraz różnicy obok siebie.
for (const [n, e] of events.entries()) {
  const id = String(n + 1).padStart(2, '0');
  e.id = id;
  e.beforeTime = ptsTimes[e.before];
  e.afterTime = ptsTimes[e.after];
  for (const [label, t] of [['before', e.beforeTime], ['after', e.afterTime]]) {
    execFileSync('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', video, '-frames:v', '1', '-y', join(outDir, `${id}-${label}.png`)]);
  }
  execFileSync('ffmpeg', [
    '-v', 'error', '-i', join(outDir, `${id}-before.png`), '-i', join(outDir, `${id}-after.png`),
    '-filter_complex',
    '[0][1]blend=all_mode=difference,curves=all=0/0 0.1/1 1/1[d];[0][1][d]hstack=3,scale=1920:-1',
    '-y', join(outDir, `${id}-compare.jpg`),
  ]);
}

writeFileSync(join(outDir, 'events.json'), JSON.stringify({ video, params: { W, H, PIXEL_THRESHOLD, MOTION_OFF, SETTLE_FRAMES, MIN_EVENT_CHANGE, LONG_MOTION_S, LARGE_CHANGE, CELL, CELL_ACTIVE, GLOBAL_SPREAD, MIN_ACTIVE_CELLS }, motion, events }, null, 2));

console.log(`Zdarzeń: ${events.length}`);
for (const e of events) {
  console.log(`${e.id}  ${e.beforeTime.toFixed(1)}s → ${e.afterTime.toFixed(1)}s  ruch=${e.motionSeconds.toFixed(1)}s  zmiana=${(e.change * 100).toFixed(2)}%  kratki=${(e.spread * 100).toFixed(1)}%  ${e.kind}`);
}
console.log(`Wyniki: ${outDir}`);
