import type { DatabaseSync } from 'node:sqlite';

type TimelineThumbnailRow = {
  asset_id: string;
  frame_index: number;
  timestamp_ms: number;
  file_name: string;
  width: number;
  height: number;
};

export type StoredTimelineThumbnail = {
  assetId: string;
  frameIndex: number;
  timestampMs: number;
  fileName: string;
  width: number;
  height: number;
};

function map(row: TimelineThumbnailRow): StoredTimelineThumbnail {
  return {
    assetId: row.asset_id,
    frameIndex: row.frame_index,
    timestampMs: row.timestamp_ms,
    fileName: row.file_name,
    width: row.width,
    height: row.height
  };
}

export class TimelineThumbnailRepository {
  constructor(private readonly database: DatabaseSync) {}

  list(assetId: string): StoredTimelineThumbnail[] {
    return (this.database.prepare(`SELECT asset_id, frame_index, timestamp_ms, file_name, width, height
      FROM timeline_thumbnails WHERE asset_id = ? ORDER BY frame_index`).all(assetId) as TimelineThumbnailRow[]).map(map);
  }

  replaceForAsset(assetId: string, frames: StoredTimelineThumbnail[]): void {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.prepare('DELETE FROM timeline_thumbnails WHERE asset_id = ?').run(assetId);
      const insert = this.database.prepare(`INSERT INTO timeline_thumbnails(
        asset_id, frame_index, timestamp_ms, file_name, width, height
      ) VALUES (?, ?, ?, ?, ?, ?)`);
      for (const frame of [...frames].sort((left, right) => left.frameIndex - right.frameIndex)) {
        if (frame.assetId !== assetId) throw new Error('A thumbnail não pertence à mídia informada.');
        insert.run(frame.assetId, frame.frameIndex, frame.timestampMs, frame.fileName, frame.width, frame.height);
      }
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  deleteForAsset(assetId: string): number {
    return Number(this.database.prepare('DELETE FROM timeline_thumbnails WHERE asset_id = ?').run(assetId).changes);
  }
}
