import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { EditorProject } from '../shared/types';

type ProjectRow = {
  id: string;
  name: string;
  status: 'active' | 'archived';
  revision: number;
  state_json: string;
  created_at: string;
  updated_at: string;
};

export class RevisionConflictError extends Error {
  constructor() {
    super('Conflito de revisão: este projeto foi salvo por outra atualização.');
  }
}

function parseState(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function mapProject(row: ProjectRow): EditorProject {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    revision: row.revision,
    state: parseState(row.state_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class ProjectRepository {
  constructor(private readonly database: DatabaseSync) {}

  create(name: string): EditorProject {
    const now = new Date().toISOString();
    const id = randomUUID();
    this.database.prepare(`
      INSERT INTO projects(id, name, status, revision, state_json, created_at, updated_at)
      VALUES (?, ?, 'active', 0, '{}', ?, ?)
    `).run(id, name, now, now);
    return this.get(id)!;
  }

  list(): EditorProject[] {
    return (this.database.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as ProjectRow[]).map(mapProject);
  }

  get(id: string): EditorProject | undefined {
    const row = this.database.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
    return row ? mapProject(row) : undefined;
  }

  saveState(id: string, expectedRevision: number, state: Record<string, unknown>, name?: string): EditorProject {
    const current = this.get(id);
    if (!current) throw new Error('Projeto não encontrado.');
    if (current.revision !== expectedRevision) throw new RevisionConflictError();
    const revision = current.revision + 1;
    const now = new Date().toISOString();
    const stateJson = JSON.stringify(state);
    const nextName = name?.trim() || current.name;

    this.database.exec('BEGIN IMMEDIATE');
    try {
      const result = this.database.prepare(`
        UPDATE projects SET name = ?, state_json = ?, revision = ?, updated_at = ?
        WHERE id = ? AND revision = ?
      `).run(nextName, stateJson, revision, now, id, expectedRevision);
      if (result.changes !== 1) throw new RevisionConflictError();
      this.database.prepare(`
        INSERT INTO project_revisions(project_id, revision, state_json, created_at)
        VALUES (?, ?, ?, ?)
      `).run(id, revision, stateJson, now);
      this.database.prepare(`
        DELETE FROM project_revisions
        WHERE project_id = ? AND id NOT IN (
          SELECT id FROM project_revisions WHERE project_id = ? ORDER BY revision DESC LIMIT 50
        )
      `).run(id, id);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
    return this.get(id)!;
  }

  delete(id: string): boolean {
    return this.database.prepare('DELETE FROM projects WHERE id = ?').run(id).changes === 1;
  }
}
