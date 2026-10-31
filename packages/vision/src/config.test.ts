import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AvFoundationSource } from './av-foundation-source.js';
import { createCameraSource, loadConfig } from './config.js';
import { VideoFileSource } from './video-file-source.js';

const defaultApi = { url: 'http://localhost:3000', password: null };
const homeDir = path.join(path.sep, 'home', 'gracz');
const defaults = { api: defaultApi, detector: 'baseline', framesDir: path.join(homeDir, '.autoscore', 'frames'), pendingConfidence: 0.8 };

describe('loadConfig', () => {
  it('uses the C920 by name and the local API without a password by default', () => {
    expect(loadConfig({}, homeDir)).toEqual({ camera: { kind: 'avfoundation', name: 'HD Pro Webcam C920:none' }, ...defaults });
  });

  it('reads and trims the camera name', () => {
    expect(loadConfig({ AUTOSCORE_CAMERA_NAME: '  FaceTime HD Camera:none \n' })).toMatchObject({
      camera: { kind: 'avfoundation', name: 'FaceTime HD Camera:none' },
    });
  });

  it('falls back to the default for a blank name', () => {
    expect(loadConfig({ AUTOSCORE_CAMERA_NAME: '   ' })).toMatchObject({
      camera: { kind: 'avfoundation', name: 'HD Pro Webcam C920:none' },
    });
  });

  it('resolves a video path to absolute', () => {
    expect(loadConfig({ AUTOSCORE_CAMERA_VIDEO: 'recordings/session.mp4' })).toMatchObject({
      camera: { kind: 'video', path: path.resolve('recordings/session.mp4') },
    });
  });

  it('prefers the video over the camera name', () => {
    expect(loadConfig({ AUTOSCORE_CAMERA_VIDEO: ' session.mp4 ', AUTOSCORE_CAMERA_NAME: 'Other:none' })).toMatchObject({
      camera: { kind: 'video', path: path.resolve('session.mp4') },
    });
  });

  it('ignores a blank video', () => {
    expect(loadConfig({ AUTOSCORE_CAMERA_VIDEO: '  ', AUTOSCORE_CAMERA_NAME: 'Other:none' })).toMatchObject({
      camera: { kind: 'avfoundation', name: 'Other:none' },
    });
  });

  it.each(['HD Pro\nWebcam', 'Cam\tera', 'Cam\u0000'])('rejects a camera name with a control character %j', (name) => {
    expect(() => loadConfig({ AUTOSCORE_CAMERA_NAME: name })).toThrow('Invalid AUTOSCORE_CAMERA_NAME');
  });
});

describe('loadConfig api', () => {
  it.each([
    ['http://localhost:3100', 'http://localhost:3100'],
    ['  http://192.168.1.20:3000  ', 'http://192.168.1.20:3000'],
    ['https://darts.example/api/', 'https://darts.example/api'],
    ['http://localhost:3000//', 'http://localhost:3000'],
    ['   ', 'http://localhost:3000'],
  ])('reads AUTOSCORE_API_URL %j as %j', (value, url) => {
    expect(loadConfig({ AUTOSCORE_API_URL: value }).api.url).toBe(url);
  });

  it.each(['localhost:3000', 'ftp://localhost', 'not a url', 'file:///tmp/api'])('rejects AUTOSCORE_API_URL %j', (value) => {
    expect(() => loadConfig({ AUTOSCORE_API_URL: value })).toThrow(`Invalid AUTOSCORE_API_URL: ${JSON.stringify(value)}`);
  });

  it('reads the password as is', () => {
    expect(loadConfig({ AUTOSCORE_PASSWORD: ' tajne hasło ' }).api).toEqual({ url: 'http://localhost:3000', password: ' tajne hasło ' });
  });

  it('treats an empty password as none', () => {
    expect(loadConfig({ AUTOSCORE_PASSWORD: '' }).api.password).toBeNull();
  });

  it('keeps the password out of the URL error', () => {
    expect(() => loadConfig({ AUTOSCORE_API_URL: 'nope', AUTOSCORE_PASSWORD: 'tajne' })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('tajne') }),
    );
  });
});

describe('loadConfig detector', () => {
  it.each([undefined, '', '  '])('defaults to baseline for %j', (value) => {
    expect(loadConfig({ AUTOSCORE_DETECTOR: value }, homeDir).detector).toBe('baseline');
  });

  it('reads and trims a known detector', () => {
    expect(loadConfig({ AUTOSCORE_DETECTOR: ' baseline ' }, homeDir).detector).toBe('baseline');
  });

  it.each(['nope', 'toString', 'constructor'])('rejects %j with the available names', (name) => {
    expect(() => loadConfig({ AUTOSCORE_DETECTOR: name }, homeDir)).toThrow(`Invalid AUTOSCORE_DETECTOR: "${name}" (available: baseline)`);
  });
});

describe('loadConfig framesDir', () => {
  it('defaults to .autoscore/frames in the home directory', () => {
    expect(loadConfig({}, homeDir).framesDir).toBe(path.join(homeDir, '.autoscore', 'frames'));
  });

  it('falls back to the default for a blank override', () => {
    expect(loadConfig({ AUTOSCORE_FRAMES_DIR: '  ' }, homeDir).framesDir).toBe(path.join(homeDir, '.autoscore', 'frames'));
  });

  it('prefers an absolute override', () => {
    const dir = path.join(path.sep, 'data', 'frames');
    expect(loadConfig({ AUTOSCORE_FRAMES_DIR: ` ${dir} ` }, homeDir).framesDir).toBe(dir);
  });

  it('resolves a relative override against the working directory', () => {
    expect(loadConfig({ AUTOSCORE_FRAMES_DIR: 'frames' }, homeDir).framesDir).toBe(path.join(process.cwd(), 'frames'));
  });
});

describe('loadConfig pendingConfidence', () => {
  it.each([undefined, ''])('defaults to 0.8 for %j', (value) => {
    expect(loadConfig({ AUTOSCORE_PENDING_CONFIDENCE: value }, homeDir).pendingConfidence).toBe(0.8);
  });

  it.each([
    ['0.75', 0.75],
    ['0', 0],
    ['1', 1],
  ])('reads %j', (value, threshold) => {
    expect(loadConfig({ AUTOSCORE_PENDING_CONFIDENCE: value }, homeDir).pendingConfidence).toBe(threshold);
  });

  it.each(['abc', '1.5', '-0.5', ' 0.8', '.5'])('rejects %j', (value) => {
    expect(() => loadConfig({ AUTOSCORE_PENDING_CONFIDENCE: value }, homeDir)).toThrow(`Invalid AUTOSCORE_PENDING_CONFIDENCE: ${value}`);
  });
});

describe('createCameraSource', () => {
  it('creates a video file source', () => {
    expect(createCameraSource({ camera: { kind: 'video', path: '/tmp/session.mp4' }, ...defaults }, 'linux')).toBeInstanceOf(
      VideoFileSource,
    );
  });

  it('creates an AVFoundation source on macOS', () => {
    expect(createCameraSource({ camera: { kind: 'avfoundation', name: 'Cam:none' }, ...defaults }, 'darwin')).toBeInstanceOf(
      AvFoundationSource,
    );
  });

  it('rejects AVFoundation outside macOS', () => {
    expect(() => createCameraSource({ camera: { kind: 'avfoundation', name: 'Cam:none' }, ...defaults }, 'linux')).toThrow(
      /macOS only.*AUTOSCORE_CAMERA_VIDEO/,
    );
  });
});
