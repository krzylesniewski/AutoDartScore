import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AvFoundationSource } from './av-foundation-source.js';
import { createCameraSource, loadConfig } from './config.js';
import { VideoFileSource } from './video-file-source.js';

describe('loadConfig', () => {
  it('uses the C920 by name by default', () => {
    expect(loadConfig({})).toEqual({ camera: { kind: 'avfoundation', name: 'HD Pro Webcam C920:none' } });
  });

  it('reads and trims the camera name', () => {
    expect(loadConfig({ AUTOSCORE_CAMERA_NAME: '  FaceTime HD Camera:none \n' })).toEqual({
      camera: { kind: 'avfoundation', name: 'FaceTime HD Camera:none' },
    });
  });

  it('falls back to the default for a blank name', () => {
    expect(loadConfig({ AUTOSCORE_CAMERA_NAME: '   ' })).toEqual({
      camera: { kind: 'avfoundation', name: 'HD Pro Webcam C920:none' },
    });
  });

  it('resolves a video path to absolute', () => {
    expect(loadConfig({ AUTOSCORE_CAMERA_VIDEO: 'recordings/session.mp4' })).toEqual({
      camera: { kind: 'video', path: path.resolve('recordings/session.mp4') },
    });
  });

  it('prefers the video over the camera name', () => {
    expect(loadConfig({ AUTOSCORE_CAMERA_VIDEO: ' session.mp4 ', AUTOSCORE_CAMERA_NAME: 'Other:none' })).toEqual({
      camera: { kind: 'video', path: path.resolve('session.mp4') },
    });
  });

  it('ignores a blank video', () => {
    expect(loadConfig({ AUTOSCORE_CAMERA_VIDEO: '  ', AUTOSCORE_CAMERA_NAME: 'Other:none' })).toEqual({
      camera: { kind: 'avfoundation', name: 'Other:none' },
    });
  });

  it.each(['HD Pro\nWebcam', 'Cam\tera', 'Cam\u0000'])('rejects a camera name with a control character %j', (name) => {
    expect(() => loadConfig({ AUTOSCORE_CAMERA_NAME: name })).toThrow('Invalid AUTOSCORE_CAMERA_NAME');
  });
});

describe('createCameraSource', () => {
  it('creates a video file source', () => {
    expect(createCameraSource({ camera: { kind: 'video', path: '/tmp/session.mp4' } }, 'linux')).toBeInstanceOf(
      VideoFileSource,
    );
  });

  it('creates an AVFoundation source on macOS', () => {
    expect(createCameraSource({ camera: { kind: 'avfoundation', name: 'Cam:none' } }, 'darwin')).toBeInstanceOf(
      AvFoundationSource,
    );
  });

  it('rejects AVFoundation outside macOS', () => {
    expect(() => createCameraSource({ camera: { kind: 'avfoundation', name: 'Cam:none' } }, 'linux')).toThrow(
      /macOS only.*AUTOSCORE_CAMERA_VIDEO/,
    );
  });
});
