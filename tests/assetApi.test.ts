// @vitest-environment node

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
      thumbnail: async (_input, output) => { writeFileSync(output, 'thumbnail'); }
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
  });
});
