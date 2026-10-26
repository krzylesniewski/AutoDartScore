const LANG = 'pl-PL';

// jsdom i starsze przeglądarki nie mają Web Speech API. Wtedy głos milczy zamiast rzucać błąd.
function synthesis(): SpeechSynthesis | null {
  return typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined' ? null : speechSynthesis;
}

// onDone przychodzi raz, gdy odczyt się skończy albo przerwie. Bez Web Speech API od razu, żeby lista części nie stanęła.
export interface TextSpeaker {
  speak(text: string, onDone?: () => void): void;
  cancel(): void;
}

export function createWebSpeechSpeaker(): TextSpeaker {
  // Chrome potrafi zgubić onend wypowiedzi, którą zebrał garbage collector, więc trzymamy bieżącą do końca.
  let current: SpeechSynthesisUtterance | null = null;

  return {
    speak(text, onDone) {
      const speech = synthesis();
      if (!speech) {
        onDone?.();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      let done = false;
      const finish = () => {
        if (current === utterance) {
          current = null;
        }
        if (done) {
          return;
        }
        done = true;
        onDone?.();
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      current = utterance;
      utterance.lang = LANG;
      const voice = speech.getVoices().find((candidate) => candidate.lang.startsWith('pl'));
      if (voice) {
        utterance.voice = voice;
      }
      speech.speak(utterance);
    },
    // Przeglądarka wywołuje wtedy onerror bieżącej wypowiedzi. Speaker nagrań pomija to dzięki pokoleniom.
    cancel() {
      synthesis()?.cancel();
    },
  };
}
