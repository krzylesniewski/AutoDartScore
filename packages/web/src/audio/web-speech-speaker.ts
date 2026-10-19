const LANG = 'pl-PL';

// jsdom i starsze przeglądarki nie mają Web Speech API. Wtedy głos milczy zamiast rzucać błąd.
function synthesis(): SpeechSynthesis | null {
  return typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined' ? null : speechSynthesis;
}

export interface TextSpeaker {
  speak(text: string): void;
  cancel(): void;
}

export function createWebSpeechSpeaker(): TextSpeaker {
  return {
    speak(text) {
      const speech = synthesis();
      if (!speech) {
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = LANG;
      const voice = speech.getVoices().find((candidate) => candidate.lang.startsWith('pl'));
      if (voice) {
        utterance.voice = voice;
      }
      speech.speak(utterance);
    },
    cancel() {
      synthesis()?.cancel();
    },
  };
}
