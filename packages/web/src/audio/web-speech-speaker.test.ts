import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebSpeechSpeaker } from './web-speech-speaker';

class FakeUtterance {
  text: string;
  lang = '';
  voice: SpeechSynthesisVoice | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

function voice(lang: string, name: string): SpeechSynthesisVoice {
  return { lang, name } as SpeechSynthesisVoice;
}

function stubSpeech(voices: SpeechSynthesisVoice[]) {
  const synthesis = { speak: vi.fn(), cancel: vi.fn(), getVoices: vi.fn(() => voices) };
  vi.stubGlobal('speechSynthesis', synthesis);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  return synthesis;
}

function spoken(synthesis: ReturnType<typeof stubSpeech>): FakeUtterance {
  const utterance = synthesis.speak.mock.calls[0]?.[0] as FakeUtterance | undefined;
  if (!utterance) {
    throw new Error('nothing spoken');
  }
  return utterance;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createWebSpeechSpeaker', () => {
  it('speaks the text in pl-PL', () => {
    const synthesis = stubSpeech([]);
    createWebSpeechSpeaker().speak('sto');
    expect(synthesis.speak).toHaveBeenCalledOnce();
    expect(spoken(synthesis)).toMatchObject({ text: 'sto', lang: 'pl-PL' });
  });

  it('picks the first Polish voice', () => {
    const polish = voice('pl-PL', 'Zosia');
    const synthesis = stubSpeech([voice('en-US', 'Samantha'), polish, voice('pl-PL', 'Ewa')]);
    createWebSpeechSpeaker().speak('sto');
    expect(spoken(synthesis).voice).toBe(polish);
  });

  it('leaves the voice unset without a Polish voice', () => {
    const synthesis = stubSpeech([voice('en-US', 'Samantha')]);
    createWebSpeechSpeaker().speak('sto');
    expect(spoken(synthesis).voice).toBeNull();
  });

  it('cancels the current speech', () => {
    const synthesis = stubSpeech([]);
    createWebSpeechSpeaker().cancel();
    expect(synthesis.cancel).toHaveBeenCalledOnce();
  });

  it('calls onDone once when the speech ends', () => {
    const synthesis = stubSpeech([]);
    const onDone = vi.fn();
    createWebSpeechSpeaker().speak('sto', onDone);
    expect(onDone).not.toHaveBeenCalled();
    spoken(synthesis).onend?.();
    spoken(synthesis).onend?.();
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('calls onDone once when the speech fails', () => {
    const synthesis = stubSpeech([]);
    const onDone = vi.fn();
    createWebSpeechSpeaker().speak('sto', onDone);
    spoken(synthesis).onerror?.();
    spoken(synthesis).onend?.();
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('calls onDone right away without the Web Speech API', () => {
    vi.stubGlobal('speechSynthesis', undefined);
    vi.stubGlobal('SpeechSynthesisUtterance', undefined);
    const onDone = vi.fn();
    createWebSpeechSpeaker().speak('sto', onDone);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('does nothing without the Web Speech API', () => {
    vi.stubGlobal('speechSynthesis', undefined);
    vi.stubGlobal('SpeechSynthesisUtterance', undefined);
    const speaker = createWebSpeechSpeaker();
    expect(() => speaker.speak('sto')).not.toThrow();
    expect(() => speaker.cancel()).not.toThrow();
  });
});
