// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { metadataFromProbe } from '../server/mediaProbe';

describe('metadataFromProbe', () => {
  it('classifies video metadata and parses rational FPS', () => {
    const metadata = metadataFromProbe('clip.mp4', {
      format: { duration: '4.25' },
      streams: [
        { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, avg_frame_rate: '30000/1001', nb_frames: '127' },
        { codec_type: 'audio', codec_name: 'aac' }
      ]
    });

    expect(metadata).toMatchObject({ kind: 'video', duration: 4.25, width: 1920, height: 1080, hasAudio: true });
    expect(metadata.fps).toBeCloseTo(29.97, 2);
  });

  it('distinguishes static and animated WebP', () => {
    const animated = metadataFromProbe('motion.webp', {
      format: { duration: '1.2' },
      streams: [{ codec_type: 'video', codec_name: 'webp', width: 480, height: 480, avg_frame_rate: '12/1', nb_frames: '14' }]
    });
    const still = metadataFromProbe('photo.webp', {
      format: {},
      streams: [{ codec_type: 'video', codec_name: 'webp', width: 480, height: 480, avg_frame_rate: '25/1', nb_frames: '1' }]
    });

    expect(animated.kind).toBe('animated-webp');
    expect(still.kind).toBe('image');
  });
});
