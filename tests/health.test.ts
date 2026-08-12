// @vitest-environment node

import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../server/index';

describe('GET /api/health', () => {
  it('reports SQLite and both media executables as ready', async () => {
    const response = await request(createApp({
      databasePath: ':memory:',
      mediaTools: {
        ffmpegPath: 'D:\\AI\\ffmpeg.exe',
        ffprobePath: 'D:\\AI\\ffprobe.exe',
        check: async () => ({ ffmpeg: true, ffprobe: true })
      }
    })).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      sqlite: 'ok',
      ffmpeg: 'ok',
      ffprobe: 'ok'
    });
  });

  it('returns service unavailable when FFmpeg is missing', async () => {
    const response = await request(createApp({
      databasePath: ':memory:',
      mediaTools: {
        ffmpegPath: 'missing',
        ffprobePath: 'missing',
        check: async () => ({ ffmpeg: false, ffprobe: true })
      }
    })).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ ok: false, ffmpeg: 'missing', ffprobe: 'ok' });
  });
});
