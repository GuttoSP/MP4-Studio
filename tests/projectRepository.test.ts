// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { createDatabase } from '../server/db';
import { ProjectRepository } from '../server/projectRepository';

describe('ProjectRepository', () => {
  it('persists state and rejects a stale autosave revision', () => {
    const database = createDatabase(':memory:');
    const repository = new ProjectRepository(database);
    const project = repository.create('Meu vídeo');

    const saved = repository.saveState(project.id, 0, { tab: 'cut', currentTime: 1.25 });

    expect(saved.revision).toBe(1);
    expect(repository.get(project.id)?.state).toEqual({ tab: 'cut', currentTime: 1.25 });
    expect(() => repository.saveState(project.id, 0, { tab: 'gif' })).toThrow('revisão');
    database.close();
  });

  it('keeps only the fifty latest revisions', () => {
    const database = createDatabase(':memory:');
    const repository = new ProjectRepository(database);
    const project = repository.create('Histórico');
    let revision = 0;
    for (let index = 0; index < 55; index += 1) {
      revision = repository.saveState(project.id, revision, { index }).revision;
    }

    expect(database.prepare('SELECT COUNT(*) AS count FROM project_revisions WHERE project_id = ?').get(project.id))
      .toEqual({ count: 50 });
    database.close();
  });
});
