import { useId, useState, type ReactNode } from 'react';
import {
  readEffectsEnabled,
  readVoiceEnabled,
  readZeroCommentsEnabled,
  writeEffectsEnabled,
  writeVoiceEnabled,
  writeZeroCommentsEnabled,
} from '../audio/use-announcer';
import { AppNav } from '../components/AppNav';
import { EffectsToggle } from '../components/EffectsToggle';
import { GridIcon, RingIcon } from '../components/icons';
import { KeypadLayoutPreview } from '../components/KeypadLayoutPreview';
import { VoiceToggle } from '../components/VoiceToggle';
import { ZeroCommentsToggle } from '../components/ZeroCommentsToggle';
import { readKeypadLayout, writeKeypadLayout, type KeypadLayout } from '../game/keypad-layout';
import { pl } from '../i18n/pl';

const LAYOUTS: readonly { value: KeypadLayout; label: string; icon: ReactNode }[] = [
  { value: 'ring', label: pl.keypadLayoutRing, icon: <RingIcon /> },
  { value: 'grid', label: pl.keypadLayoutGrid, icon: <GridIcon /> },
];

const sectionTitle = 'font-display text-(length:--text-label) leading-none font-bold uppercase tracking-[0.18em] text-(--color-text-muted)';
// Globalny pierścień fokusu pomija radio, więc fokus rysuje karta, która je obejmuje.
const layoutCard =
  'relative flex min-h-11 min-w-0 cursor-pointer flex-col gap-4 overflow-hidden rounded-(--radius-panel) px-3.5 py-4 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--color-focus) sm:px-6 sm:py-5.5 lg:h-85';
const checkedCard = 'bg-linear-to-b from-(--color-surface-raised) to-(--color-surface) inset-ring-2 inset-ring-(--color-text) shadow-(--shadow-panel)';
const uncheckedCard = 'bg-(--color-surface-softer) shadow-(--shadow-inset-line)';

// Stan czytamy i zapisujemy wprost w localStorage, bez hooka głosu, który tworzy obiekty mowy i dźwięku. Tutaj nie ma czego odczytywać.
export function SettingsScreen() {
  const group = useId();
  const [layout, setLayout] = useState<KeypadLayout>(readKeypadLayout);
  const [voice, setVoice] = useState(readVoiceEnabled);
  const [effects, setEffects] = useState(readEffectsEnabled);
  const [zeroComments, setZeroComments] = useState(readZeroCommentsEnabled);

  function changeLayout(next: KeypadLayout): void {
    writeKeypadLayout(next);
    setLayout(next);
  }

  function changeVoice(next: boolean): void {
    writeVoiceEnabled(next);
    setVoice(next);
  }

  function changeEffects(next: boolean): void {
    writeEffectsEnabled(next);
    setEffects(next);
  }

  function changeZeroComments(next: boolean): void {
    writeZeroCommentsEnabled(next);
    setZeroComments(next);
  }

  return (
    <div className="flex h-full flex-col">
      <AppNav current="settings" voiceEnabled={voice} />
      <main className="flex min-h-0 flex-1 flex-col gap-7 overflow-auto px-4 pt-4 pb-6 sm:px-8 lg:gap-8.5 lg:px-(--space-page) lg:pt-10 lg:pb-8">
        <div className="flex flex-col gap-2.5">
          <h1 className="font-display text-[clamp(40px,10vw,64px)] leading-[0.9] font-black tracking-[0.01em] uppercase">{pl.settings}</h1>
          <p className="text-[17px] text-(--color-text-muted)">{pl.settingsSubtitle}</p>
        </div>
        <div className="flex flex-col gap-7 lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start lg:gap-(--space-page)">
          <section aria-labelledby={`${group}-keypad`} className="flex max-w-xl flex-col gap-3.5 lg:max-w-none">
            <h2 id={`${group}-keypad`} className={sectionTitle}>
              {pl.settingsKeypad}
            </h2>
            {/* Natywne radio daje strzałki i Tab bez własnej obsługi klawiatury. Zaznaczenie ma pierścień, grubszą etykietę i ✓, więc kolor nie jest jedyną wskazówką. */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
              {LAYOUTS.map((option) => {
                const checked = layout === option.value;
                return (
                  <label key={option.value} className={`${layoutCard} ${checked ? checkedCard : uncheckedCard}`}>
                    <input
                      type="radio"
                      name={`${group}-layout`}
                      value={option.value}
                      checked={checked}
                      onChange={() => changeLayout(option.value)}
                      className="sr-only"
                    />
                    <KeypadLayoutPreview layout={option.value} />
                    <span className="mt-auto flex min-w-0 items-center gap-2 sm:gap-3">
                      <span aria-hidden="true" className="text-xl text-(--color-text-sub) sm:text-[26px]">
                        {option.icon}
                      </span>
                      <span className={`min-w-0 flex-1 truncate font-display text-2xl leading-none sm:text-[30px] ${checked ? 'font-extrabold' : 'font-bold'}`}>
                        {option.label}
                      </span>
                      {checked && (
                        <span
                          aria-hidden="true"
                          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--color-text) font-display text-xl leading-none font-bold text-(--color-text-inverse) sm:size-9 sm:text-[22px]"
                        >
                          ✓
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
          <section aria-labelledby={`${group}-sound`} className="flex flex-col gap-3.5">
            <h2 id={`${group}-sound`} className={sectionTitle}>
              {pl.settingsSound}
            </h2>
            <div className="flex flex-col gap-3.5">
              <VoiceToggle enabled={voice} onChange={changeVoice} variant="card" />
              <EffectsToggle enabled={effects} onChange={changeEffects} variant="card" />
              <ZeroCommentsToggle enabled={zeroComments} disabled={!voice} onChange={changeZeroComments} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
