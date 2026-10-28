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
import { GridIcon, RingIcon, TargetIcon } from '../components/icons';
import { VoiceToggle } from '../components/VoiceToggle';
import { ZeroCommentsToggle } from '../components/ZeroCommentsToggle';
import { readKeypadLayout, writeKeypadLayout, type KeypadLayout } from '../game/keypad-layout';
import { pl } from '../i18n/pl';

const LAYOUTS: readonly { value: KeypadLayout; label: string; preview: ReactNode }[] = [
  { value: 'ring', label: pl.keypadLayoutRing, preview: <RingIcon /> },
  { value: 'grid', label: pl.keypadLayoutGrid, preview: <GridIcon /> },
];

const sectionTitle = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';

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
      <main className="flex min-h-0 flex-1 flex-col gap-7 overflow-auto px-4 pt-4 pb-6 sm:px-8 lg:px-12 lg:pt-7 lg:pb-8">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[length:clamp(2.5rem,10vw,3.5rem)] leading-none font-bold uppercase">{pl.settings}</h1>
          <p className="text-[17px] text-(--color-text-muted)">{pl.settingsSubtitle}</p>
        </div>
        <section aria-labelledby={`${group}-keypad`} className="flex max-w-xl flex-col gap-2.5">
          <h2 id={`${group}-keypad`} className={sectionTitle}>
            {pl.settingsKeypad}
          </h2>
          {/* Natywne radio daje strzałki i Tab bez własnej obsługi klawiatury. Zaznaczenie ma ramkę i ✓, więc kolor nie jest jedyną wskazówką. */}
          <div className="grid grid-cols-2 gap-2.5">
            {LAYOUTS.map((option) => {
              const checked = layout === option.value;
              return (
                <label
                  key={option.value}
                  className={`relative flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-(--radius-card) border-(length:--border-width) bg-(--color-surface) px-4 py-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--color-text) ${checked ? 'border-(--color-text)' : 'border-(--color-border-strong)'}`}
                >
                  <input
                    type="radio"
                    name={`${group}-layout`}
                    value={option.value}
                    checked={checked}
                    onChange={() => changeLayout(option.value)}
                    className="sr-only"
                  />
                  <span aria-hidden="true" className="text-4xl text-(--color-text-muted)">
                    {option.preview}
                  </span>
                  <span className="min-w-0 flex-1 font-display text-xl font-semibold">{option.label}</span>
                  <span aria-hidden="true" className="font-display text-xl font-bold">
                    {checked ? '✓' : ''}
                  </span>
                </label>
              );
            })}
          </div>
        </section>
        <section aria-labelledby={`${group}-sound`} className="flex flex-col gap-2.5">
          <h2 id={`${group}-sound`} className={sectionTitle}>
            {pl.settingsSound}
          </h2>
          <div className="flex flex-wrap gap-2.5">
            <VoiceToggle enabled={voice} onChange={changeVoice} />
            <EffectsToggle enabled={effects} onChange={changeEffects} />
            <ZeroCommentsToggle enabled={zeroComments} disabled={!voice} onChange={changeZeroComments} />
          </div>
        </section>
        <section aria-labelledby={`${group}-camera`} className="flex flex-col gap-2.5">
          <h2 id={`${group}-camera`} className={sectionTitle}>
            {pl.settingsCamera}
          </h2>
          <a
            href="#/settings/calibration"
            className="flex min-h-12 w-fit items-center gap-2 rounded-(--radius-chip) border-(length:--border-width) border-(--color-border-strong) bg-(--color-surface-button) px-4 text-(length:--text-button) text-(--color-text)"
          >
            <TargetIcon />
            {pl.calibration}
          </a>
        </section>
      </main>
    </div>
  );
}
