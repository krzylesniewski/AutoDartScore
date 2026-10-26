import type { Announcement } from '@autoscore/audio';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createRecordedSpeaker, type ClipAudio, type RecordedSpeaker } from './recorded-speaker';

class FakeAudio implements ClipAudio {
  currentTime = 0;
  preload = '';
  readonly calls: string[] = [];
  private readonly listeners: Record<'error' | 'ended', (() => void)[]> = { error: [], ended: [] };

  constructor(
    readonly src: string,
    private readonly playResult: () => unknown,
  ) {}

  play(): unknown {
    this.calls.push('play');
    return this.playResult();
  }

  pause(): void {
    this.calls.push('pause');
  }

  load(): void {
    this.calls.push('load');
  }

  addEventListener(type: 'error' | 'ended', listener: () => void): void {
    this.listeners[type].push(listener);
  }

  fail(): void {
    for (const listener of this.listeners.error) {
      listener();
    }
  }

  end(): void {
    for (const listener of this.listeners.ended) {
      listener();
    }
  }
}

const STO = { text: 'sto', clip: 'scores/100.mp3' };
const TURN_RECORD = { text: 'Nowy rekord tury', clip: 'events/achievement_turn_record.mp3' };
const FIRST_140 = { text: 'Pierwsze sto czterdzieści', clip: 'events/first_140.mp3' };
const sto: Announcement = { kind: 'score', parts: [STO] };
const bust: Announcement = { kind: 'bust', parts: [{ text: 'Bust', clip: 'events/bust_1.mp3' }] };
const unreachable: Announcement = { kind: 'score', parts: [{ text: 'sto sześćdziesiąt trzy', clip: null }] };
const twoParts: Announcement = { kind: 'score', parts: [STO, TURN_RECORD] };
const threeParts: Announcement = { kind: 'score', parts: [{ text: 'sto czterdzieści', clip: 'scores/140.mp3' }, FIRST_140, TURN_RECORD] };

const EVENT_URLS = [
  '/audio/pl/events/bust_1.mp3',
  '/audio/pl/events/bust_2.mp3',
  '/audio/pl/events/bust_3.mp3',
  '/audio/pl/events/game_shot.mp3',
  '/audio/pl/events/winner_1.mp3',
  '/audio/pl/events/winner_2.mp3',
  '/audio/pl/events/zero_1.mp3',
  '/audio/pl/events/zero_2.mp3',
  '/audio/pl/events/first_100.mp3',
  '/audio/pl/events/first_120.mp3',
  '/audio/pl/events/first_140.mp3',
  '/audio/pl/events/first_180.mp3',
  '/audio/pl/events/achievement_turn_record.mp3',
  '/audio/pl/events/achievement_checkout_record.mp3',
  '/audio/pl/events/achievement_shortest_leg.mp3',
  '/audio/pl/events/achievement_longest_leg.mp3',
];

let created: FakeAudio[];
let playResult: () => unknown;
let fallback: { speak: Mock<(text: string, onDone?: () => void) => void>; cancel: Mock<() => void> };
let speaker: RecordedSpeaker;

function createAudio(src: string): FakeAudio {
  const audio = new FakeAudio(src, () => playResult());
  created.push(audio);
  return audio;
}

function only(): FakeAudio {
  const [audio, ...rest] = created;
  if (!audio || rest.length > 0) {
    throw new Error(`expected one element, got ${created.length}`);
  }
  return audio;
}

// Obietnica, którą test odrzuca w wybranej chwili, jak play() przerwane przez pause() albo zablokowane.
function deferredRejection(): { promise: Promise<void>; reject: (error: Error) => void } {
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<void>((_resolve, rejectPromise) => {
    reject = rejectPromise;
  });
  return { promise, reject };
}

function spokenTexts(): string[] {
  return fallback.speak.mock.calls.map(([text]) => text);
}

// Kończy odczyt tekstu o podanym numerze, jak onend wypowiedzi.
function finishSpeech(index: number): void {
  const onDone = fallback.speak.mock.calls[index]?.[1];
  if (!onDone) {
    throw new Error(`no speech ${index}`);
  }
  onDone();
}

function audioFor(src: string): FakeAudio {
  const audio = created.find((candidate) => candidate.src === src);
  if (!audio) {
    throw new Error(`no element for ${src}`);
  }
  return audio;
}

function played(): string[] {
  return created.flatMap((audio) => audio.calls.filter((call) => call === 'play').map(() => audio.src));
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  created = [];
  playResult = () => Promise.resolve();
  fallback = { speak: vi.fn<(text: string, onDone?: () => void) => void>(), cancel: vi.fn<() => void>() };
  speaker = createRecordedSpeaker(fallback, createAudio);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createRecordedSpeaker', () => {
  it('plays the clip URL for an announcement', async () => {
    speaker.speak(sto);
    await flush();
    expect(only().src).toBe('/audio/pl/scores/100.mp3');
    expect(only().calls).toEqual(['play']);
    expect(fallback.speak).not.toHaveBeenCalled();
  });

  it('speaks the text at once and creates no element without a clip', () => {
    speaker.speak(unreachable);
    expect(spokenTexts()).toEqual(['sto sześćdziesiąt trzy']);
    expect(created).toEqual([]);
  });

  it('speaks the text when play() throws', () => {
    playResult = () => {
      throw new Error('play failed');
    };
    speaker.speak(sto);
    expect(spokenTexts()).toEqual(['sto']);
  });

  it('speaks the text when play() returns no promise', () => {
    playResult = () => undefined;
    speaker.speak(sto);
    expect(spokenTexts()).toEqual(['sto']);
  });

  it('speaks the text when play() rejects', async () => {
    playResult = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
    speaker.speak(sto);
    expect(fallback.speak).not.toHaveBeenCalled();
    await flush();
    expect(spokenTexts()).toEqual(['sto']);
  });

  it('speaks the text on an error event and creates a new element on the next use', async () => {
    speaker.speak(sto);
    only().fail();
    expect(spokenTexts()).toEqual(['sto']);
    speaker.speak(sto);
    await flush();
    expect(created.map((audio) => audio.src)).toEqual(['/audio/pl/scores/100.mp3', '/audio/pl/scores/100.mp3']);
    expect(created[1]?.calls).toEqual(['play']);
    expect(fallback.speak).toHaveBeenCalledTimes(1);
  });

  it('falls back once when both a rejection and an error event happen', async () => {
    const play = deferredRejection();
    playResult = () => play.promise;
    speaker.speak(sto);
    only().fail();
    play.reject(new DOMException('not found', 'NotSupportedError'));
    await flush();
    expect(spokenTexts()).toEqual(['sto']);
  });

  it('pauses and rewinds the previous clip before the next one', () => {
    speaker.speak(sto);
    const previous = only();
    previous.currentTime = 1.5;
    speaker.speak(bust);
    expect(previous.calls).toEqual(['play', 'pause']);
    expect(previous.currentTime).toBe(0);
    expect(created[1]?.calls).toEqual(['play']);
  });

  it('speaks nothing for a late rejection after a newer speak', async () => {
    const play = deferredRejection();
    playResult = () => play.promise;
    speaker.speak(sto);
    playResult = () => Promise.resolve();
    speaker.speak(bust);
    play.reject(new DOMException('interrupted', 'AbortError'));
    await flush();
    expect(fallback.speak).not.toHaveBeenCalled();
  });

  it('speaks nothing for a late error after a newer speak', async () => {
    speaker.speak(sto);
    const previous = only();
    speaker.speak(bust);
    previous.fail();
    await flush();
    expect(fallback.speak).not.toHaveBeenCalled();
  });

  it('speaks nothing for a late rejection after cancel', async () => {
    const play = deferredRejection();
    playResult = () => play.promise;
    speaker.speak(sto);
    speaker.cancel();
    play.reject(new DOMException('interrupted', 'AbortError'));
    await flush();
    expect(fallback.speak).not.toHaveBeenCalled();
  });

  it('speaks nothing for a late error after cancel', async () => {
    speaker.speak(sto);
    speaker.cancel();
    only().fail();
    await flush();
    expect(fallback.speak).not.toHaveBeenCalled();
  });

  it('stops the clip and cancels the fallback on cancel', () => {
    speaker.speak(sto);
    only().currentTime = 1.5;
    speaker.cancel();
    expect(only().calls).toEqual(['play', 'pause']);
    expect(only().currentTime).toBe(0);
    expect(fallback.cancel).toHaveBeenCalledTimes(1);
  });

  it('preloads exactly the 16 event clips once', () => {
    speaker.preload();
    expect(created.map((audio) => audio.src)).toEqual(EVENT_URLS);
    for (const audio of created) {
      expect(audio.preload).toBe('auto');
      expect(audio.calls).toEqual(['load']);
    }
    speaker.preload();
    expect(created).toHaveLength(16);
    expect(created.flatMap((audio) => audio.calls)).toEqual(Array(16).fill('load'));
  });

  it('reuses one element for the same URL', () => {
    speaker.speak(sto);
    speaker.speak(sto);
    expect(only().calls).toEqual(['play', 'pause', 'play']);
  });

  it('plays a preloaded event clip without a new element', () => {
    speaker.preload();
    speaker.speak(bust);
    expect(created).toHaveLength(16);
    expect(created[0]?.calls).toEqual(['load', 'play']);
  });

  it('creates elements with the global Audio by default', () => {
    vi.stubGlobal(
      'Audio',
      class {
        constructor(src: string) {
          return createAudio(src);
        }
      },
    );
    createRecordedSpeaker(fallback).speak(sto);
    expect(only().src).toBe('/audio/pl/scores/100.mp3');
    expect(only().calls).toEqual(['play']);
  });

  it('uses the fallback without a global Audio', () => {
    vi.stubGlobal('Audio', undefined);
    const recorded = createRecordedSpeaker(fallback);
    recorded.preload();
    recorded.speak(sto);
    expect(spokenTexts()).toEqual(['sto']);
  });

  it('plays two parts in order, the second only after the first ended', async () => {
    speaker.speak(twoParts);
    await flush();
    expect(played()).toEqual(['/audio/pl/scores/100.mp3']);
    audioFor('/audio/pl/scores/100.mp3').end();
    await flush();
    expect(played()).toEqual(['/audio/pl/scores/100.mp3', '/audio/pl/events/achievement_turn_record.mp3']);
    expect(fallback.speak).not.toHaveBeenCalled();
  });

  it('plays three parts in order, each after the previous ended', async () => {
    speaker.speak(threeParts);
    audioFor('/audio/pl/scores/140.mp3').end();
    expect(played()).toEqual(['/audio/pl/scores/140.mp3', '/audio/pl/events/first_140.mp3']);
    audioFor('/audio/pl/events/first_140.mp3').end();
    audioFor('/audio/pl/events/achievement_turn_record.mp3').end();
    await flush();
    expect(played()).toEqual(['/audio/pl/scores/140.mp3', '/audio/pl/events/first_140.mp3', '/audio/pl/events/achievement_turn_record.mp3']);
    expect(fallback.speak).not.toHaveBeenCalled();
  });

  it('reads a middle part without a clip, then plays the next clip', () => {
    speaker.speak({ kind: 'score', parts: [STO, { text: 'Pierwsza setka', clip: null }, TURN_RECORD] });
    audioFor('/audio/pl/scores/100.mp3').end();
    expect(spokenTexts()).toEqual(['Pierwsza setka']);
    expect(played()).toEqual(['/audio/pl/scores/100.mp3']);
    finishSpeech(0);
    expect(played()).toEqual(['/audio/pl/scores/100.mp3', '/audio/pl/events/achievement_turn_record.mp3']);
  });

  it('reads a failing middle part, then plays the next clip', () => {
    speaker.speak(threeParts);
    audioFor('/audio/pl/scores/140.mp3').end();
    audioFor('/audio/pl/events/first_140.mp3').fail();
    expect(spokenTexts()).toEqual(['Pierwsze sto czterdzieści']);
    finishSpeech(0);
    expect(played()).toEqual(['/audio/pl/scores/140.mp3', '/audio/pl/events/first_140.mp3', '/audio/pl/events/achievement_turn_record.mp3']);
  });

  it('reads a rejected middle part, then plays the next clip', async () => {
    speaker.speak(threeParts);
    playResult = () => Promise.reject(new DOMException('not found', 'NotSupportedError'));
    audioFor('/audio/pl/scores/140.mp3').end();
    await flush();
    expect(spokenTexts()).toEqual(['Pierwsze sto czterdzieści']);
    playResult = () => Promise.resolve();
    finishSpeech(0);
    expect(played()).toEqual(['/audio/pl/scores/140.mp3', '/audio/pl/events/first_140.mp3', '/audio/pl/events/achievement_turn_record.mp3']);
  });

  it('moves on once when a failing part also ends', () => {
    speaker.speak(threeParts);
    audioFor('/audio/pl/scores/140.mp3').end();
    const failing = audioFor('/audio/pl/events/first_140.mp3');
    failing.fail();
    failing.end();
    expect(played()).toEqual(['/audio/pl/scores/140.mp3', '/audio/pl/events/first_140.mp3']);
    finishSpeech(0);
    finishSpeech(0);
    expect(played()).toEqual(['/audio/pl/scores/140.mp3', '/audio/pl/events/first_140.mp3', '/audio/pl/events/achievement_turn_record.mp3']);
  });

  it('reads every part in turn without a global Audio', () => {
    vi.stubGlobal('Audio', undefined);
    createRecordedSpeaker(fallback).speak(twoParts);
    expect(spokenTexts()).toEqual(['sto']);
    finishSpeech(0);
    expect(spokenTexts()).toEqual(['sto', 'Nowy rekord tury']);
  });

  it('stops the list on cancel in the middle and ignores a late ended', async () => {
    speaker.speak(threeParts);
    audioFor('/audio/pl/scores/140.mp3').end();
    const middle = audioFor('/audio/pl/events/first_140.mp3');
    speaker.cancel();
    expect(middle.calls).toEqual(['play', 'pause']);
    middle.end();
    await flush();
    expect(played()).toEqual(['/audio/pl/scores/140.mp3', '/audio/pl/events/first_140.mp3']);
    expect(fallback.speak).not.toHaveBeenCalled();
  });

  it('ignores a late onDone after cancel', () => {
    speaker.speak({ kind: 'score', parts: [{ text: 'Pierwsza setka', clip: null }, TURN_RECORD] });
    speaker.cancel();
    finishSpeech(0);
    expect(created).toEqual([]);
    expect(spokenTexts()).toEqual(['Pierwsza setka']);
  });

  it('ignores a late ended of an older announcement', () => {
    speaker.speak(twoParts);
    const previous = audioFor('/audio/pl/scores/100.mp3');
    speaker.speak(bust);
    previous.end();
    expect(played()).toEqual(['/audio/pl/scores/100.mp3', '/audio/pl/events/bust_1.mp3']);
  });

  it('does not fall back on a stale rejection from an earlier part', async () => {
    const play = deferredRejection();
    playResult = () => play.promise;
    speaker.speak(twoParts);
    playResult = () => Promise.resolve();
    audioFor('/audio/pl/scores/100.mp3').end();
    play.reject(new DOMException('interrupted', 'AbortError'));
    await flush();
    expect(fallback.speak).not.toHaveBeenCalled();
    expect(played()).toEqual(['/audio/pl/scores/100.mp3', '/audio/pl/events/achievement_turn_record.mp3']);
  });
});
