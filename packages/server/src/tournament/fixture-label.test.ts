import { describe, expect, it } from 'vitest';
import { fixtureLabel } from './fixture-label.js';

describe('fixtureLabel', () => {
  it.each([
    ['league', 'g-1', 'Liga, mecz 1'],
    ['league', 'g-45', 'Liga, mecz 45'],
    ['group_playoff', 'g-7', 'Grupa, mecz 7'],
    ['cup', 'p-r16-3', '1/8 finału 3'],
    ['cup', 'p-qf-2', 'Ćwierćfinał 2'],
    ['group_playoff', 'p-sf-1', 'Półfinał 1'],
    ['cup', 'p-f', 'Finał'],
    ['cup', 'p-3rd', 'Mecz o 3. miejsce'],
    ['group_playoff', 'c-f', 'Pocieszenie'],
    ['group_playoff', 'c-sf-2', 'Pocieszenie, półfinał 2'],
    ['group_playoff', 'c-qf-4', 'Pocieszenie, ćwierćfinał 4'],
    ['group_playoff', 'c-r16-8', 'Pocieszenie, 1/8 finału 8'],
  ] as const)('%s %s is %s', (format, fixtureId, label) => {
    expect(fixtureLabel(format, fixtureId)).toBe(label);
  });

  it.each(['x-1', 'g-', 'g-1a', 'p-sf', 'p-final', 'c-3rd', 'p-qf-2-1', ''])('keeps an unknown id %j unchanged', (fixtureId) => {
    expect(fixtureLabel('cup', fixtureId)).toBe(fixtureId);
  });
});
