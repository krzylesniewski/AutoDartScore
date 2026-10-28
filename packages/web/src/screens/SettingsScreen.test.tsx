import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnnouncer } from '../audio/use-announcer';
import { Keypad } from '../components/Keypad';
import { SettingsScreen } from './SettingsScreen';

function radio(name: string): HTMLInputElement {
  return screen.getByRole('radio', { name }) as HTMLInputElement;
}

function toggle(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

function blockStorage(): void {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
}

// Hook useAnnouncer od razu wczytuje nagrania, a jsdom nie ma load().
class FakeAudio {
  currentTime = 0;
  preload = '';

  play(): Promise<void> {
    return Promise.resolve();
  }

  pause(): void {}

  load(): void {}

  addEventListener(): void {}
}

beforeEach(() => {
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('speechSynthesis', { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [] });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('SettingsScreen', () => {
  it('shows the heading and the subtitle', () => {
    render(<SettingsScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Ustawienia' })).toBeTruthy();
    expect(screen.getByText('Zapisane na tym urządzeniu')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Klawiatura' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Dźwięk' })).toBeTruthy();
  });

  it('links to the camera calibration in the Kamera section', () => {
    render(<SettingsScreen />);
    const section = screen.getByRole('region', { name: 'Kamera' });
    const link = within(section).getByRole('link', { name: 'Kalibracja kamery' });
    expect(link.getAttribute('href')).toBe('#/settings/calibration');
    expect(link.className).toContain('min-h-12');
  });

  it('marks the settings page in the nav', () => {
    render(<SettingsScreen />);
    expect(screen.getByRole('link', { name: 'Ustawienia' }).getAttribute('aria-current')).toBe('page');
  });

  it('selects Koło by default with a check mark on the selected card only', () => {
    render(<SettingsScreen />);
    expect(radio('Koło').checked).toBe(true);
    expect(radio('Siatka').checked).toBe(false);
    expect(radio('Koło').closest('label')?.textContent).toContain('✓');
    expect(radio('Siatka').closest('label')?.textContent).not.toContain('✓');
    for (const name of ['Koło', 'Siatka']) {
      expect(radio(name).closest('label')?.querySelector('svg')).not.toBeNull();
      expect(radio(name).closest('label')?.className).toContain('min-h-11');
    }
  });

  it('preselects a stored grid', () => {
    localStorage.setItem('autoscore.keypadLayout', 'grid');
    render(<SettingsScreen />);
    expect(radio('Siatka').checked).toBe(true);
    expect(radio('Koło').checked).toBe(false);
  });

  it('shows Koło for an unknown stored layout', () => {
    localStorage.setItem('autoscore.keypadLayout', 'hex');
    render(<SettingsScreen />);
    expect(radio('Koło').checked).toBe(true);
  });

  it('stores the picked layout and the keypad uses it', () => {
    const { unmount } = render(<SettingsScreen />);
    fireEvent.click(radio('Siatka'));
    expect(radio('Siatka').checked).toBe(true);
    expect(localStorage.getItem('autoscore.keypadLayout')).toBe('grid');
    unmount();

    render(<Keypad onHit={vi.fn()} onRestMiss={vi.fn()} onUndo={vi.fn()} disabled={false} undoDisabled={false} checkout={null} />);
    for (const segment of ['20', '1', '5']) {
      expect(screen.getByRole('button', { name: segment }).className.split(' ')).not.toContain('rounded-full');
    }
  });

  it('stores ring when Koło is picked', () => {
    localStorage.setItem('autoscore.keypadLayout', 'grid');
    render(<SettingsScreen />);
    fireEvent.click(radio('Koło'));
    expect(radio('Koło').checked).toBe(true);
    expect(localStorage.getItem('autoscore.keypadLayout')).toBe('ring');
  });

  it('turns voice and effects on by default and stores off', () => {
    render(<SettingsScreen />);
    expect(toggle('Głos').getAttribute('aria-pressed')).toBe('true');
    expect(toggle('Efekty dźwiękowe').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(toggle('Głos'));
    fireEvent.click(toggle('Efekty dźwiękowe'));
    expect(toggle('Głos').getAttribute('aria-pressed')).toBe('false');
    expect(toggle('Efekty dźwiękowe').getAttribute('aria-pressed')).toBe('false');
    expect(localStorage.getItem('autoscore.voice')).toBe('off');
    expect(localStorage.getItem('autoscore.effects')).toBe('off');

    fireEvent.click(toggle('Głos'));
    expect(localStorage.getItem('autoscore.voice')).toBe('on');
  });

  it('shows stored off values as not pressed', () => {
    localStorage.setItem('autoscore.voice', 'off');
    localStorage.setItem('autoscore.effects', 'off');
    render(<SettingsScreen />);
    expect(toggle('Głos').getAttribute('aria-pressed')).toBe('false');
    expect(toggle('Efekty dźwiękowe').getAttribute('aria-pressed')).toBe('false');
  });

  it('gives the game the switches turned off in settings', () => {
    render(<SettingsScreen />);
    fireEvent.click(toggle('Głos'));
    const voiceOnly = renderHook(useAnnouncer);
    expect(voiceOnly.result.current.voiceEnabled).toBe(false);
    expect(voiceOnly.result.current.effectsEnabled).toBe(true);
    voiceOnly.unmount();

    fireEvent.click(toggle('Efekty dźwiękowe'));
    const both = renderHook(useAnnouncer);
    expect(both.result.current.effectsEnabled).toBe(false);
  });

  it('shows the switches turned off in the game', () => {
    const { result, unmount } = renderHook(useAnnouncer);
    act(() => {
      result.current.setVoiceEnabled(false);
      result.current.setEffectsEnabled(false);
    });
    unmount();

    render(<SettingsScreen />);
    expect(toggle('Głos').getAttribute('aria-pressed')).toBe('false');
    expect(toggle('Efekty dźwiękowe').getAttribute('aria-pressed')).toBe('false');
  });

  it('turns zero comments off by default and stores on and off', () => {
    render(<SettingsScreen />);
    expect(toggle('Komentarze do zera').getAttribute('aria-pressed')).toBe('false');
    expect(toggle('Komentarze do zera').textContent).toContain('wyłączone');

    fireEvent.click(toggle('Komentarze do zera'));
    expect(toggle('Komentarze do zera').getAttribute('aria-pressed')).toBe('true');
    expect(toggle('Komentarze do zera').textContent).toContain('włączone');
    expect(localStorage.getItem('autoscore.zeroComments')).toBe('on');

    fireEvent.click(toggle('Komentarze do zera'));
    expect(toggle('Komentarze do zera').getAttribute('aria-pressed')).toBe('false');
    expect(localStorage.getItem('autoscore.zeroComments')).toBe('off');
  });

  it('disables zero comments while the voice is stored off', () => {
    localStorage.setItem('autoscore.voice', 'off');
    localStorage.setItem('autoscore.zeroComments', 'on');
    render(<SettingsScreen />);
    expect(toggle('Komentarze do zera').hasAttribute('disabled')).toBe(true);
    expect(toggle('Komentarze do zera').getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps the stored zero comments choice when the voice goes off and on', () => {
    render(<SettingsScreen />);
    fireEvent.click(toggle('Komentarze do zera'));

    fireEvent.click(toggle('Głos'));
    expect(toggle('Komentarze do zera').hasAttribute('disabled')).toBe(true);
    expect(toggle('Komentarze do zera').getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('autoscore.zeroComments')).toBe('on');

    fireEvent.click(toggle('Głos'));
    expect(toggle('Komentarze do zera').hasAttribute('disabled')).toBe(false);
    expect(toggle('Komentarze do zera').getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('autoscore.zeroComments')).toBe('on');
  });

  it('shows the defaults and still changes on screen when localStorage throws', () => {
    blockStorage();
    render(<SettingsScreen />);
    expect(radio('Koło').checked).toBe(true);
    expect(toggle('Głos').getAttribute('aria-pressed')).toBe('true');
    expect(toggle('Efekty dźwiękowe').getAttribute('aria-pressed')).toBe('true');
    expect(toggle('Komentarze do zera').getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(radio('Siatka'));
    fireEvent.click(toggle('Głos'));
    fireEvent.click(toggle('Efekty dźwiękowe'));
    expect(radio('Siatka').checked).toBe(true);
    expect(toggle('Głos').getAttribute('aria-pressed')).toBe('false');
    expect(toggle('Efekty dźwiękowe').getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps the nav voice status in step with the voice switch', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Głos: włączony')).toBeTruthy();
    fireEvent.click(toggle('Głos'));
    expect(screen.getByText('Głos: wyłączony')).toBeTruthy();
    fireEvent.click(toggle('Głos'));
    expect(screen.getByText('Głos: włączony')).toBeTruthy();
  });
});
