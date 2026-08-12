import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const MIGRATION_VERSION = 1;

const migration = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    revision INTEGER NOT NULL DEFAULT 0,
    state_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('video', 'animated-webp', 'image')),
    duration REAL NOT NULL DEFAULT 0,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    fps REAL NOT NULL DEFAULT 0,
    has_audio INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    thumbnail_name TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS project_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    state_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(project_id, revision)
  );

  CREATE TABLE IF NOT EXISTS render_jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    operation TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'interrupted')),
    phase TEXT NOT NULL DEFAULT 'queued',
    progress REAL NOT NULL DEFAULT 0,
    processed_seconds REAL NOT NULL DEFAULT 0,
    total_seconds REAL NOT NULL DEFAULT 0,
    output_name TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_revisions_project ON project_revisions(project_id, revision DESC);
  CREATE INDEX IF NOT EXISTS idx_jobs_project ON render_jobs(project_id, created_at DESC);
`;

export function createDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  database.exec('PRAGMA foreign_keys = ON');
  if (path !== ':memory:') database.exec('PRAGMA journal_mode = WAL');
  database.exec('BEGIN IMMEDIATE');
  try {
    database.exec(migration);
    database.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)')
      .run(MIGRATION_VERSION, new Date().toISOString());
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    database.close();
    throw error;
  }
  return database;
}
