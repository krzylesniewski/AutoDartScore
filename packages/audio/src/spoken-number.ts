const MAX_TURN_TOTAL = 180;

const UNITS = ['zero', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć'];
const TEENS = [
  'dziesięć',
  'jedenaście',
  'dwanaście',
  'trzynaście',
  'czternaście',
  'piętnaście',
  'szesnaście',
  'siedemnaście',
  'osiemnaście',
  'dziewiętnaście',
];
const TENS = ['', '', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt', 'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt'];
const HUNDRED = 'sto';

// Słowa zamiast cyfr: każdy głos czyta je tak samo, a później dają się zamienić na nagrane klipy.
export function spokenNumber(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > MAX_TURN_TOTAL) {
    throw new RangeError(`Expected an integer from 0 to ${MAX_TURN_TOTAL}, got ${value}`);
  }
  if (value === 0) {
    return UNITS[0] ?? '';
  }
  const words: string[] = [];
  if (value >= 100) {
    words.push(HUNDRED);
  }
  const rest = value % 100;
  const tens = Math.floor(rest / 10);
  const units = rest % 10;
  if (tens === 1) {
    words.push(TEENS[units] ?? '');
  } else {
    if (tens > 1) {
      words.push(TENS[tens] ?? '');
    }
    if (units > 0) {
      words.push(UNITS[units] ?? '');
    }
  }
  return words.join(' ');
}
