// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { createDatabase } from '../server/db';
import { TimelineThumbnailRepository } from '../server/timelineThumbnailRepository';

describe('TimelineThumbnailRepository', () => {
  it('replaces frames in temporal order and cascades them with the asset', () => {
    const database = createDatabase(':memory:');
    const now = '2026-08-12T12:00:00.000Z';
    const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const assetId = '11111111-1111-4111-8111-111111111111';
    database.prepare(`INSERT INTO projects(id,name,status,revision,state_json,created_at,updated_at)
      VALUES (?,?,'active',0,'{}',?,?)`).run(projectId, 'Projeto', now, now);
    database.prepare(`INSERT INTO assets(id,project_id,original_name,stored_name,kind,duration,width,height,fps,has_audio,sort_order,thumbnail_name,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(assetId, projectId, 'vertical.mp4', 'asset.mp4', 'video', 2, 720, 1280, 30, 0, 0, 'poster.jpg', now);
    const repository = new TimelineThumbnailRepository(database);

    repository.replaceForAsset(assetId, [
      { assetId, frameIndex: 1, timestampMs: 500, fileName: '001.jpg', width: 135, height: 240 },
      { assetId, frameIndex: 0, timestampMs: 0, fileName: '000.jpg', width: 135, height: 240 }
    ]);

    expect(repository.list(assetId).map(({ frameIndex, timestampMs, width, height }) => ({ frameIndex, timestampMs, width, height }))).toEqual([
      { frameIndex: 0, timestampMs: 0, width: 135, height: 240 },
      { frameIndex: 1, timestampMs: 500, width: 135, height: 240 }
    ]);

    database.prepare('DELETE FROM assets WHERE id = ?').run(assetId);
    expect(repository.list(assetId)).toEqual([]);
    database.close();
  });

  it('atomically replaces an existing filmstrip', () => {
    const database = createDatabase(':memory:');
    const now = '2026-08-12T12:00:00.000Z';
    const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const assetId = '11111111-1111-4111-8111-111111111111';
    database.prepare(`INSERT INTO projects(id,name,status,revision,state_json,created_at,updated_at)
      VALUES (?,?,'active',0,'{}',?,?)`).run(projectId, 'Projeto', now, now);
    database.prepare(`INSERT INTO assets(id,project_id,original_name,stored_name,kind,duration,width,height,fps,has_audio,sort_order,thumbnail_name,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(assetId, projectId, 'video.mp4', 'asset.mp4', 'video', 2, 1280, 720, 30, 0, 0, 'poster.jpg', now);
    const repository = new TimelineThumbnailRepository(database);
    repository.replaceForAsset(assetId, [{ assetId, frameIndex: 0, timestampMs: 0, fileName: 'old.jpg', width: 240, height: 135 }]);

    repository.replaceForAsset(assetId, [{ assetId, frameIndex: 0, timestampMs: 250, fileName: 'new.jpg', width: 240, height: 135 }]);

    expect(repository.list(assetId)).toEqual([{ assetId, frameIndex: 0, timestampMs: 250, fileName: 'new.jpg', width: 240, height: 135 }]);
    database.close();
  });
});
