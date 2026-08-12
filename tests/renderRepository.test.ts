// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { createDatabase } from '../server/db';
import { ProjectRepository } from '../server/projectRepository';
import { RenderRepository } from '../server/renderRepository';

describe('RenderRepository', () => {
  it('persists progress and recovers active jobs as interrupted', () => {
    const database = createDatabase(':memory:');
    const project = new ProjectRepository(database).create('Render');
    const repository = new RenderRepository(database);
    const job = repository.create(project.id, 'cut', { operation: 'cut' }, 8);
    repository.markRunning(job.id);
    repository.updateProgress(job.id, 3, 8);
    expect(repository.get(job.id)).toMatchObject({ status: 'running', progress: 37.5 });

    repository.recoverInterrupted();
    expect(repository.get(job.id)).toMatchObject({ status: 'interrupted', phase: 'interrupted' });
    database.close();
  });
});
