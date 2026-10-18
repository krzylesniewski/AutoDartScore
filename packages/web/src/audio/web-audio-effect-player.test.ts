import { effectDurationMs, effectTones } from '@autoscore/audio';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebAudioEffectPlayer } from './web-audio-effect-player';

class FakeParam {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class FakeNode extends EventTarget {
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeOscillator extends FakeNode {
  type = 'sine';
  frequency = new FakeParam();
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  static initialState: AudioContextState = 'running';
  state: AudioContextState = FakeAudioContext.initialState;
  currentTime = 2;
  destination = new FakeNode();
  oscillators: FakeOscillator[] = [];
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  close = vi.fn(async () => {
    this.state = 'closed';
  });

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createOscillator(): FakeOscillator {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain(): FakeGain {
    return new FakeGain();
  }
}

function stubAudio(state: AudioContextState = 'running'): void {
  FakeAudioContext.instances = [];
  FakeAudioContext.initialState = state;
  vi.stubGlobal('AudioContext', FakeAudioContext);
}

function onlyContext(): FakeAudioContext {
  const [context] = FakeAudioContext.instances;
  if (!context || FakeAudioContext.instances.length !== 1) {
    throw new Error(`expected one AudioContext, got ${FakeAudioContext.instances.length}`);
  }
  return context;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createWebAudioEffectPlayer', () => {
  it('creates no AudioContext before the first effect', () => {
    stubAudio();
    createWebAudioEffectPlayer();
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('plays one oscillator per tone, offset by currentTime', () => {
    stubAudio();
    const duration = createWebAudioEffectPlayer().play('fanfare_short');
    const tones = effectTones('fanfare_short');
    const context = onlyContext();
    expect(duration).toBe(effectDurationMs('fanfare_short'));
    expect(context.oscillators).toHaveLength(tones.length);
    context.oscillators.forEach((oscillator, index) => {
      const tone = tones[index];
      if (!tone) {
        throw new Error('missing tone');
      }
      const start = context.currentTime + tone.startMs / 1000;
      expect(oscillator.type).toBe(tone.wave);
      expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(tone.frequency, start);
      expect(oscillator.start).toHaveBeenCalledWith(start);
      expect(oscillator.stop).toHaveBeenCalledWith(start + tone.durationMs / 1000);
    });
  });

  it('glides the bust tones down to their end frequency', () => {
    stubAudio();
    createWebAudioEffectPlayer().play('bust');
    const tones = effectTones('bust');
    onlyContext().oscillators.forEach((oscillator, index) => {
      expect(oscillator.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(tones[index]?.endFrequency, expect.any(Number));
    });
  });

  it('resumes a suspended context', () => {
    stubAudio('suspended');
    createWebAudioEffectPlayer().play('bust');
    expect(onlyContext().resume).toHaveBeenCalledOnce();
  });

  it('reuses one context across effects', () => {
    stubAudio();
    const player = createWebAudioEffectPlayer();
    player.play('bust');
    player.play('fanfare_long');
    expect(onlyContext().oscillators).toHaveLength(effectTones('bust').length + effectTones('fanfare_long').length);
  });

  it('stops the oscillators that still play', () => {
    stubAudio();
    const player = createWebAudioEffectPlayer();
    player.play('fanfare_long');
    const [ended, ...playing] = onlyContext().oscillators;
    ended?.dispatchEvent(new Event('ended'));
    ended?.stop.mockClear();
    player.stop();
    expect(ended?.stop).not.toHaveBeenCalled();
    for (const oscillator of playing) {
      expect(oscillator.stop).toHaveBeenLastCalledWith();
      expect(oscillator.disconnect).toHaveBeenCalled();
    }
  });

  it('ignores an oscillator that throws on stop', () => {
    stubAudio();
    const player = createWebAudioEffectPlayer();
    player.play('bust');
    for (const oscillator of onlyContext().oscillators) {
      oscillator.stop.mockImplementation(() => {
        throw new Error('InvalidStateError');
      });
    }
    expect(() => player.stop()).not.toThrow();
  });

  it('closes the context and opens a new one on the next effect', () => {
    stubAudio();
    const player = createWebAudioEffectPlayer();
    player.play('bust');
    const first = onlyContext();
    player.close();
    expect(first.close).toHaveBeenCalledOnce();
    expect(first.oscillators.every((oscillator) => oscillator.stop.mock.calls.length === 2)).toBe(true);
    player.play('bust');
    expect(FakeAudioContext.instances).toHaveLength(2);
    expect(FakeAudioContext.instances[1]?.oscillators).toHaveLength(effectTones('bust').length);
  });

  it('does nothing without the Web Audio API', () => {
    vi.stubGlobal('AudioContext', undefined);
    const player = createWebAudioEffectPlayer();
    expect(player.play('fanfare_long')).toBe(0);
    expect(() => player.stop()).not.toThrow();
    expect(() => player.close()).not.toThrow();
  });
});
