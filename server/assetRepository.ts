import type { DatabaseSync } from 'node:sqlite';
import type { AssetKind, EditorAsset } from '../shared/types';

type AssetRow = {
  id: string; project_id: string; original_name: string; stored_name: string; kind: AssetKind;
  duration: number; width: number; height: number; fps: number; has_audio: number; sort_order: number;
  thumbnail_name: string | null; created_at: string;
};

export type StoredAsset = EditorAsset & { storedName: string; thumbnailName?: string; createdAt: string };

function map(row: AssetRow): StoredAsset {
  return {
    id: row.id, projectId: row.project_id, name: row.original_name, storedName: row.stored_name,
    thumbnailName: row.thumbnail_name ?? undefined, kind: row.kind, duration: row.duration,
    width: row.width, height: row.height, fps: row.fps, hasAudio: Boolean(row.has_audio),
    sortOrder: row.sort_order, createdAt: row.created_at
  };
}

export class AssetRepository {
  constructor(private readonly database: DatabaseSync) {}

  create(asset: StoredAsset): StoredAsset {
    this.database.prepare(`INSERT INTO assets(
      id, project_id, original_name, stored_name, kind, duration, width, height, fps, has_audio,
      sort_order, thumbnail_name, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(asset.id, asset.projectId, asset.name, asset.storedName, asset.kind, asset.duration,
        asset.width, asset.height, asset.fps, asset.hasAudio ? 1 : 0, asset.sortOrder,
        asset.thumbnailName ?? null, asset.createdAt);
    return this.get(asset.id)!;
  }

  nextSortOrder(projectId: string): number {
    const row = this.database.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM assets WHERE project_id = ?')
      .get(projectId) as { next: number };
    return row.next;
  }

  get(id: string): StoredAsset | undefined {
    const row = this.database.prepare('SELECT * FROM assets WHERE id = ?').get(id) as AssetRow | undefined;
    return row ? map(row) : undefined;
  }

  list(projectId: string): StoredAsset[] {
    return (this.database.prepare('SELECT * FROM assets WHERE project_id = ? ORDER BY sort_order, created_at').all(projectId) as AssetRow[]).map(map);
  }

  delete(id: string): boolean { return this.database.prepare('DELETE FROM assets WHERE id = ?').run(id).changes === 1; }
}

export function publicAsset(asset: StoredAsset): EditorAsset {
  const { storedName: _storedName, thumbnailName: _thumbnailName, createdAt: _createdAt, ...safe } = asset;
  return safe;
}
