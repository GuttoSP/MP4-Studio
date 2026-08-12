// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../server/db';

const cleanup: string[] = [];

afterEach(() => {
  for (const directory of cleanup.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('createDatabase', () => {
  it('creates the versioned editor schema with foreign keys enabled', () => {
    const directory = mkdtempSync(join(tmpdir(), 'editor-mp4-db-'));
    cleanup.push(directory);
    const database = createDatabase(join(directory, 'editor.sqlite3'));
    try {
      const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
      const tableNames = tables.map(({ name }) => name);

      expect(tableNames).toEqual(expect.arrayContaining([
        'schema_migrations',
        'projects',
        'assets',
        'timeline_thumbnails',
        'project_revisions',
        'render_jobs'
      ]));
      expect(database.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 });
      expect(database.prepare('SELECT version FROM schema_migrations ORDER BY version').all()).toEqual([{ version: 1 }, { version: 2 }]);
    } finally {
      database.close();
    }
  });

  it('reopens an existing database without duplicating migrations', () => {
    const directory = mkdtempSync(join(tmpdir(), 'editor-mp4-reopen-'));
    cleanup.push(directory);
    const path = join(directory, 'editor.sqlite3');

    createDatabase(path).close();
    const reopened = createDatabase(path);
    try {
      expect(reopened.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()).toEqual({ count: 2 });
    } finally {
      reopened.close();
    }
  });
});
