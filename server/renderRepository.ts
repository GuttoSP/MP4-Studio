import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { RenderJob, RenderStatus } from '../shared/types';

type RenderRow = {
  id: string; project_id: string; operation: string; status: RenderStatus; phase: string; progress: number;
  output_name: string | null; error: string | null; created_at: string; updated_at: string;
};

function map(row: RenderRow): RenderJob {
  return {
    id: row.id, projectId: row.project_id, operation: row.operation, status: row.status,
    phase: row.phase, progress: row.progress, outputName: row.output_name ?? undefined,
    error: row.error ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at
  };
}

export class RenderRepository {
  constructor(private readonly database: DatabaseSync) {}

  create(projectId: string, operation: string, payload: unknown, totalSeconds: number): RenderJob {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.database.prepare(`INSERT INTO render_jobs(
      id, project_id, operation, payload_json, status, phase, progress, total_seconds, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'queued', 'queued', 0, ?, ?, ?)`)
      .run(id, projectId, operation, JSON.stringify(payload), totalSeconds, now, now);
    return this.get(id)!;
  }

  get(id: string): RenderJob | undefined {
    const row = this.database.prepare('SELECT * FROM render_jobs WHERE id = ?').get(id) as RenderRow | undefined;
    return row ? map(row) : undefined;
  }

  list(projectId?: string): RenderJob[] {
    const rows = projectId
      ? this.database.prepare('SELECT * FROM render_jobs WHERE project_id = ? ORDER BY created_at DESC').all(projectId)
      : this.database.prepare('SELECT * FROM render_jobs ORDER BY created_at DESC LIMIT 100').all();
    return (rows as RenderRow[]).map(map);
  }

  markRunning(id: string) { this.update(id, 'running', 'rendering'); }

  updateProgress(id: string, processed: number, total: number) {
    const progress = total > 0 ? Math.max(0, Math.min(100, processed / total * 100)) : 0;
    this.database.prepare(`UPDATE render_jobs SET processed_seconds = ?, total_seconds = ?, progress = ?, updated_at = ? WHERE id = ?`)
      .run(processed, total, progress, new Date().toISOString(), id);
  }

  complete(id: string, outputName: string) {
    this.database.prepare(`UPDATE render_jobs SET status = 'completed', phase = 'completed', progress = 100, output_name = ?, updated_at = ? WHERE id = ?`)
      .run(outputName, new Date().toISOString(), id);
  }

  fail(id: string, error: string) {
    this.database.prepare(`UPDATE render_jobs SET status = 'failed', phase = 'failed', error = ?, updated_at = ? WHERE id = ?`)
      .run(error, new Date().toISOString(), id);
  }

  cancel(id: string) { this.update(id, 'cancelled', 'cancelled'); }

  recoverInterrupted() {
    this.database.prepare(`UPDATE render_jobs SET status = 'interrupted', phase = 'interrupted', error = 'Render interrompido pelo encerramento do aplicativo.', updated_at = ? WHERE status IN ('queued', 'running')`)
      .run(new Date().toISOString());
  }

  private update(id: string, status: RenderStatus, phase: string) {
    this.database.prepare('UPDATE render_jobs SET status = ?, phase = ?, updated_at = ? WHERE id = ?')
      .run(status, phase, new Date().toISOString(), id);
  }
}
