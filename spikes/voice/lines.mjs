// Teksty klipów głosu. Nastrój zależy od sumy tury; humor siedzi w krótkich komentarzach,
// które aplikacja dokleja losowo po liczbie, więc nie płacimy za żart przy każdej z 172 liczb.

const UNITS = ['zero', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć'];
const TEENS = ['dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście', 'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście'];
const TENS = ['', '', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt', 'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt'];

function spoken(value) {
  if (value === 0) return 'zero';
  const words = [];
  if (value >= 100) words.push('sto');
  const rest = value % 100;
  const tens = Math.floor(rest / 10);
  const units = rest % 10;
  if (tens === 1) words.push(TEENS[units]);
  else {
    if (tens > 1) words.push(TENS[tens]);
    if (units > 0) words.push(UNITS[units]);
  }
  return words.join(' ');
}

const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// Sumy, których nie da się rzucić trzema rzutkami: nie generujemy ich.
const IMPOSSIBLE = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);

export function mood(total) {
  if (total <= 20) return 'disappointed';
  if (total <= 40) return 'bored';
  if (total <= 80) return 'normal';
  if (total <= 120) return 'excited';
  return 'hyped';
}

function scoreText(total) {
  const word = capital(spoken(total));
  if (total === 0) return '[sighs] Zero.';
  if (total === 180) return '[shouting] STO... OSIEMDZIESIĄT!';
  switch (mood(total)) {
    case 'disappointed':
      return `[sighs] ${word}...`;
    case 'bored':
      return `[bored] ${word}.`;
    case 'normal':
      return `${word}.`;
    case 'excited':
      return `[excited] ${word}!`;
    case 'hyped':
      return `[excited] ${word}!!`;
  }
}

export const scores = Array.from({ length: 181 }, (_, total) => total)
  .filter((total) => !IMPOSSIBLE.has(total))
  .map((total) => ({ file: `scores/${total}.mp3`, text: scoreText(total) }));

const comments = {
  disappointed: [
    '[sighs] No cóż... bywa.',
    'Tarcza jest trochę wyżej.',
    '[sarcastic] Rozgrzewka, prawda?',
    'Może jutro będzie lepiej.',
    '[sighs] Nawet nie skomentuję.',
  ],
  bored: [
    '[bored] Mhm.',
    'Szału nie ma.',
    '[yawns] Przepraszam, zasnąłem.',
    'Poprawnie. I tyle.',
  ],
  normal: ['Solidnie.', 'Do przodu.', 'Dobra robota.'],
  excited: ['[excited] O, ładnie!', 'Teraz rozmawiamy!', '[excited] Ktoś tu się rozgrzał!'],
  hyped: ['[excited] Co za tura!', '[laughs] Tarcza płacze!', '[excited] Niesamowite! Zróbcie mu zdjęcie!'],
};

export const commentLines = Object.entries(comments).flatMap(([name, lines]) =>
  lines.map((text, index) => ({ file: `comments/${name}_${index + 1}.mp3`, text })),
);

export const events = [
  { file: 'events/bust_1.mp3', text: '[laughs] Bust! Za dużo dobrego.' },
  { file: 'events/bust_2.mp3', text: 'Bust. Wracamy do punktu wyjścia.' },
  { file: 'events/bust_3.mp3', text: '[sighs] Bust. Matematyka boli.' },
  { file: 'events/game_shot.mp3', text: '[excited] Game shot!' },
  { file: 'events/winner_1.mp3', text: '[excited] Mamy zwycięzcę!' },
  { file: 'events/winner_2.mp3', text: '[shouting] Koniec gry! Gratulacje!' },
];

export const all = [...scores, ...commentLines, ...events];

// Próbka do odsłuchu przed pełnym generowaniem: po jednej liczbie z każdego nastroju plus humor.
const SAMPLE = ['scores/7.mp3', 'scores/26.mp3', 'scores/60.mp3', 'scores/100.mp3', 'scores/140.mp3', 'scores/180.mp3', 'comments/disappointed_2.mp3', 'events/bust_1.mp3'];
export const sample = all.filter((line) => SAMPLE.includes(line.file));
