// @vitest-environment node

import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../server/index';

const mediaTools = {
  ffmpegPath: 'ffmpeg',
  ffprobePath: 'ffprobe',
  check: async () => ({ ffmpeg: true, ffprobe: true })
};

describe('project API', () => {
  it('creates, autosaves and reloads a project', async () => {
    const app = createApp({ databasePath: ':memory:', mediaTools });
    const created = await request(app).post('/api/projects').send({ name: 'Filme da praia' });
    expect(created.status).toBe(201);

    const saved = await request(app).patch(`/api/projects/${created.body.id}`).send({
      expectedRevision: 0,
      name: 'Campanha de verão',
      state: { tab: 'cut', currentTime: 4.2 }
    });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ name: 'Campanha de verão', revision: 1 });

    const loaded = await request(app).get(`/api/projects/${created.body.id}`);
    expect(loaded.status).toBe(200);
    expect(loaded.body.project.state).toEqual({ tab: 'cut', currentTime: 4.2 });
    expect(loaded.body.assets).toEqual([]);
  });

  it('returns conflict for a stale revision', async () => {
    const app = createApp({ databasePath: ':memory:', mediaTools });
    const created = await request(app).post('/api/projects').send({ name: 'Projeto' });
    await request(app).patch(`/api/projects/${created.body.id}`).send({ expectedRevision: 0, state: { a: 1 } });
    const stale = await request(app).patch(`/api/projects/${created.body.id}`).send({ expectedRevision: 0, state: { a: 2 } });

    expect(stale.status).toBe(409);
    expect(stale.body.error).toContain('revisão');
  });
});
