// Generuje klipy głosu przez ElevenLabs. Plik, który już istnieje, jest pomijany, więc kredyty idą tylko raz.
// Użycie: node spikes/voice/generate.mjs [sample|all] [--dry-run]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { all, sample } from './lines.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'out', process.env.MODEL_ID ?? 'eleven_v3', 'pl');
const only = process.env.ONLY?.split(',');
const set = (process.argv[2] === 'all' ? all : sample).filter((line) => !only || only.includes(line.file));
const dryRun = process.argv.includes('--dry-run');

const VOICE_ID = process.env.VOICE_ID ?? 'TX3LPaxmHKxFdv7VOQHJ'; // Liam (premade, mówi po polsku; głosy z biblioteki wymagają płatnego planu)
const MODEL_ID = process.env.MODEL_ID ?? 'eleven_v3';

function apiKey() {
  const env = readFileSync(join(here, '..', '..', '.env'), 'utf8');
  const line = env.split('\n').find((entry) => entry.startsWith('11_LABS='));
  if (!line) throw new Error('Brak 11_LABS w .env');
  return line.slice('11_LABS='.length).trim().replace(/^["']|["']$/g, '');
}

const todo = set.filter((line) => !existsSync(join(outDir, line.file)));
const chars = todo.reduce((sum, line) => sum + line.text.length, 0);
console.log(`Do wygenerowania: ${todo.length} z ${set.length} klipów, ${chars} znaków.`);
if (dryRun) process.exit(0);

const key = apiKey();
let used = 0;
for (const line of todo) {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: line.text,
      model_id: MODEL_ID,
      language_code: 'pl',
      voice_settings: { stability: 0.5 },
    }),
  });
  if (!response.ok) {
    console.error(`${line.file}: ${response.status} ${await response.text()}`);
    process.exit(1);
  }
  const target = join(outDir, line.file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  used += Number(response.headers.get('x-character-count') ?? line.text.length);
  console.log(`${line.file}  "${line.text}"`);
}
console.log(`Gotowe. Zużyte znaki: ${used}.`);
