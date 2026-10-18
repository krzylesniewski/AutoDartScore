import { effectDurationMs, effectTones, type EffectPlayer, type Tone } from '@autoscore/audio';

const MASTER_GAIN = 0.3;
const ATTACK_S = 0.01;
// Rampa wykładnicza nie dochodzi do zera, więc wygaszamy do bardzo małej wartości.
const SILENT_GAIN = 0.0001;

export interface WebAudioEffectPlayer extends EffectPlayer {
  close(): void;
}

// jsdom i starsze przeglądarki nie mają Web Audio API. Wtedy efekt milczy i zwraca 0, żeby głos nie czekał.
function hasWebAudio(): boolean {
  return typeof AudioContext !== 'undefined';
}

export function createWebAudioEffectPlayer(): WebAudioEffectPlayer {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  const live = new Set<OscillatorNode>();

  function ready(): { audio: AudioContext; output: GainNode } {
    if (!context || !master || context.state === 'closed') {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(context.destination);
    }
    if (context.state === 'suspended') {
      context.resume().catch(() => undefined);
    }
    return { audio: context, output: master };
  }

  function schedule(audio: AudioContext, output: AudioNode, tone: Tone): void {
    const start = audio.currentTime + tone.startMs / 1000;
    const end = start + tone.durationMs / 1000;

    const oscillator = audio.createOscillator();
    oscillator.type = tone.wave;
    oscillator.frequency.setValueAtTime(tone.frequency, start);
    if (tone.endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequency, end);
    }

    const gain = audio.createGain();
    gain.gain.setValueAtTime(SILENT_GAIN, start);
    gain.gain.linearRampToValueAtTime(tone.gain, start + ATTACK_S);
    gain.gain.exponentialRampToValueAtTime(SILENT_GAIN, end);

    oscillator.connect(gain);
    gain.connect(output);
    oscillator.addEventListener('ended', () => {
      live.delete(oscillator);
      gain.disconnect();
    });
    live.add(oscillator);
    oscillator.start(start);
    oscillator.stop(end);
  }

  function stop(): void {
    for (const oscillator of live) {
      try {
        oscillator.stop();
        oscillator.disconnect();
      } catch {
        // Węzeł już się skończył, nie ma czego zatrzymywać.
      }
    }
    live.clear();
  }

  return {
    play(effect) {
      if (!hasWebAudio()) {
        return 0;
      }
      const { audio, output } = ready();
      for (const tone of effectTones(effect)) {
        schedule(audio, output, tone);
      }
      return effectDurationMs(effect);
    },
    stop,
    close() {
      stop();
      context?.close().catch(() => undefined);
      context = null;
      master = null;
    },
  };
}
