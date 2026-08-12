// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { parseProgressChunk } from '../server/renderRunner';

describe('parseProgressChunk', () => {
  it('extracts processed seconds and completion state from FFmpeg progress', () => {
    expect(parseProgressChunk('frame=24\nout_time_us=2500000\nprogress=continue\n')).toEqual({
      processedSeconds: 2.5,
      ended: false
    });
    expect(parseProgressChunk('out_time_ms=8000000\nprogress=end\n')).toEqual({
      processedSeconds: 8,
      ended: true
    });
  });
});
