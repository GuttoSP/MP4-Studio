// @vitest-environment node

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/index';

const cleanup: string[] = [];
afterEach(() => cleanup.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })));

describe('asset API', () => {
  it('imports, persists and streams an opaque media asset', async () => {
    const root = mkdtempSync(join(tmpdir(), 'editor-assets-'));
    cleanup.push(root);
    const app = createApp({
      databasePath: ':memory:', dataRoot: root,
      mediaTools: { ffmpegPath: 'fake', ffprobePath: 'fake', check: async () => ({ ffmpeg: true, ffprobe: true }) },
      probe: async () => ({ kind: 'video', duration: 2, width: 640, height: 360, fps: 24, hasAudio: true }),
      thumbnail: async (_input, output) => { writeFileSync(output, 'thumbnail'); },
      timelineThumbnails: async (_input, outputDirectory) => {
        mkdirSync(outputDirectory, { recursive: true });
        writeFileSync(join(outputDirectory, '000.jpg'), 'frame-zero');
        writeFileSync(join(outputDirectory, '001.jpg'), 'frame-one');
        return [
          { frameIndex: 0, timestampMs: 0, fileName: '000.jpg', width: 240, height: 135 },
          { frameIndex: 1, timestampMs: 500, fileName: '001.jpg', width: 240, height: 135 }
        ];
      }
    });
    const project = await request(app).post('/api/projects').send({ name: 'Importação' });

    const imported = await request(app)
      .post(`/api/projects/${project.body.id}/assets`)
      .attach('files', Buffer.from('video-bytes'), { filename: 'meu-video.mp4', contentType: 'video/mp4' });

    expect(imported.status).toBe(201);
    expect(imported.body.assets[0]).toMatchObject({ name: 'meu-video.mp4', kind: 'video', duration: 2 });
    expect(imported.body.assets[0]).not.toHaveProperty('storedName');

    const streamed = await request(app).get(`/api/assets/${imported.body.assets[0].id}/content`);
    expect(streamed.status).toBe(200);
    expect(Buffer.from(streamed.body).toString()).toBe('video-bytes');
    const storedFiles = readFileSync(join(root, 'projects', project.body.id, 'assets', `${imported.body.assets[0].id}.mp4`));
    expect(storedFiles.toString()).toBe('video-bytes');

    const filmstrip = await request(app).get(`/api/assets/${imported.body.assets[0].id}/timeline-thumbnails`);
    expect(filmstrip.status).toBe(200);
    expect(filmstrip.body.frames).toEqual([
      { frameIndex: 0, time: 0, width: 240, height: 135, url: `/api/assets/${imported.body.assets[0].id}/timeline-thumbnails/0` },
      { frameIndex: 1, time: 0.5, width: 240, height: 135, url: `/api/assets/${imported.body.assets[0].id}/timeline-thumbnails/1` }
    ]);
    expect(JSON.stringify(filmstrip.body)).not.toContain(root);

    const frame = await request(app).get(`/api/assets/${imported.body.assets[0].id}/timeline-thumbnails/1`);
    expect(frame.status).toBe(200);
    expect(Buffer.from(frame.body).toString()).toBe('frame-one');
  });
});
