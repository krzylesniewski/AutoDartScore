import type { Announcement } from '@autoscore/audio';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createRecordedSpeaker, type ClipAudio, type RecordedSpeaker } from './recorded-speaker';

class FakeAudio implements ClipAudio {
  currentTime = 0;
  preload = '';
  readonly calls: string[] = [];
  private readonly errorListeners: (() => void)[] = [];

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

  addEventListener(_type: 'error', listener: () => void): void {
    this.errorListeners.push(listener);
  }

  fail(): void {
    for (const listener of this.errorListeners) {
      listener();
    }
  }
}

const sto: Announcement = { kind: 'score', text: 'sto', clip: 'scores/100.mp3' };
const bust: Announcement = { kind: 'bust', text: 'Bust', clip: 'events/bust_1.mp3' };
const unreachable: Announcement = { kind: 'score', text: 'sto sześćdziesiąt trzy', clip: null };

const EVENT_URLS = [
  '/audio/pl/events/bust_1.mp3',
  '/audio/pl/events/bust_2.mp3',
  '/audio/pl/events/bust_3.mp3',
  '/audio/pl/events/game_shot.mp3',
  '/audio/pl/events/winner_1.mp3',
  '/audio/pl/events/winner_2.mp3',
];

let created: FakeAudio[];
let playResult: () => unknown;
let fallback: { speak: Mock<(text: string) => void>; cancel: Mock<() => void> };
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

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  created = [];
  playResult = () => Promise.resolve();
  fallback = { speak: vi.fn<(text: string) => void>(), cancel: vi.fn<() => void>() };
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
    expect(fallback.speak.mock.calls).toEqual([['sto sześćdziesiąt trzy']]);
    expect(created).toEqual([]);
  });

  it('speaks the text when play() throws', () => {
    playResult = () => {
      throw new Error('play failed');
    };
    speaker.speak(sto);
    expect(fallback.speak.mock.calls).toEqual([['sto']]);
  });

  it('speaks the text when play() returns no promise', () => {
    playResult = () => undefined;
    speaker.speak(sto);
    expect(fallback.speak.mock.calls).toEqual([['sto']]);
  });

  it('speaks the text when play() rejects', async () => {
    playResult = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
    speaker.speak(sto);
    expect(fallback.speak).not.toHaveBeenCalled();
    await flush();
    expect(fallback.speak.mock.calls).toEqual([['sto']]);
  });

  it('speaks the text on an error event and creates a new element on the next use', async () => {
    speaker.speak(sto);
    only().fail();
    expect(fallback.speak.mock.calls).toEqual([['sto']]);
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
    expect(fallback.speak.mock.calls).toEqual([['sto']]);
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

  it('preloads exactly the six event clips once', () => {
    speaker.preload();
    expect(created.map((audio) => audio.src)).toEqual(EVENT_URLS);
    for (const audio of created) {
      expect(audio.preload).toBe('auto');
      expect(audio.calls).toEqual(['load']);
    }
    speaker.preload();
    expect(created).toHaveLength(6);
    expect(created.flatMap((audio) => audio.calls)).toEqual(Array(6).fill('load'));
  });

  it('reuses one element for the same URL', () => {
    speaker.speak(sto);
    speaker.speak(sto);
    expect(only().calls).toEqual(['play', 'pause', 'play']);
  });

  it('plays a preloaded event clip without a new element', () => {
    speaker.preload();
    speaker.speak(bust);
    expect(created).toHaveLength(6);
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
    expect(fallback.speak.mock.calls).toEqual([['sto']]);
  });
});
