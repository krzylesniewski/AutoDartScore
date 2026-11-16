import type { LiveMessage, MatchSnapshot } from '@autoscore/schema';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnnouncer } from './use-announcer';

const { speech, player } = vi.hoisted(() => ({
  speech: { speak: vi.fn(), cancel: vi.fn(), preload: vi.fn() },
  player: { play: vi.fn(() => 0), stop: vi.fn(), close: vi.fn() },
}));

vi.mock('./recorded-speaker', () => ({ createRecordedSpeaker: () => speech }));
vi.mock('./web-audio-effect-player', () => ({ createWebAudioEffectPlayer: () => player }));

const MATCH_ID = 'm_1';
// Announcer nie zagląda do snapshotu, więc wystarczy pusta atrapa.
const state = {} as MatchSnapshot;

// Bust daje i efekt, i komunikat głosowy.
const bustBatch: LiveMessage[] = [
  {
    type: 'bust',
    matchId: MATCH_ID,
    eventSeq: 5,
    playerId: 'anna',
    legIndex: 0,
    turnIndex: 1,
    darts: [{ segment: 20, multiplier: 3 }],
    remaining: 40,
  },
  { type: 'state_updated', matchId: MATCH_ID, eventSeq: 5, state },
];

function send(onLiveMessage: (message: LiveMessage) => void): void {
  act(() => {
    for (const message of bustBatch) {
      onLiveMessage(message);
    }
    vi.runAllTimers();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('useAnnouncer', () => {
  it('passes a live message after mount to the announcer', () => {
    const { result } = renderHook(useAnnouncer);
    expect(speech.preload).toHaveBeenCalledTimes(1);
    send(result.current.onLiveMessage);
    expect(player.play).toHaveBeenCalledWith('bust');
    expect(speech.speak).toHaveBeenCalledTimes(1);
  });

  it('plays nothing with both switches off', () => {
    localStorage.setItem('autoscore.voice', 'off');
    localStorage.setItem('autoscore.effects', 'off');
    const { result } = renderHook(useAnnouncer);
    send(result.current.onLiveMessage);
    expect(player.play).not.toHaveBeenCalled();
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('stops the announcer and closes the player on unmount', () => {
    const { unmount } = renderHook(useAnnouncer);
    expect(player.close).not.toHaveBeenCalled();
    unmount();
    expect(speech.cancel).toHaveBeenCalled();
    expect(player.stop).toHaveBeenCalled();
    expect(player.close).toHaveBeenCalledTimes(1);
  });
});
