// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/index';
import { ProjectRepository } from '../server/projectRepository';
import { RenderRepository } from '../server/renderRepository';

const cleanup: string[] = [];

afterEach(() => cleanup.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })));

describe('render output API', () => {
  it('downloads a completed render stored below a hidden directory', async () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'editor-render-output-'));
    const dataRoot = join(temporaryRoot, '.isolated-worktree', 'data');
    cleanup.push(temporaryRoot);

    const app = createApp({
      databasePath: ':memory:',
      dataRoot,
      mediaTools: {
        ffmpegPath: 'fake',
        ffprobePath: 'fake',
        check: async () => ({ ffmpeg: true, ffprobe: true })
      }
    });
    const database = app.locals.database;
    const project = new ProjectRepository(database).create('Download isolado');
    const renders = new RenderRepository(database);
    const job = renders.create(project.id, 'cut', { operation: 'cut' }, 1);
    const outputName = 'resultado.mp4';
    const outputPath = join(dataRoot, 'projects', project.id, 'renders', job.id, outputName);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, Buffer.from('render-completo'));
    renders.complete(job.id, outputName);

    const response = await request(app).get(`/api/jobs/${job.id}/output?download=1`);

    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toContain('attachment;');
    expect(response.body).toEqual(Buffer.from('render-completo'));
    database.close();
  });
});
