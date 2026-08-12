import { describe, expect, it, vi } from 'vitest';
import { createInitialEditorHistory, editorReducer, serializeExport } from '../src/editor/editorState';
import type { EditorAsset } from '../shared/types';

const asset: EditorAsset = {
  id: '11111111-1111-4111-8111-111111111111',
  projectId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'praia.mp4', kind: 'video', duration: 45, width: 1920, height: 1080,
  fps: 30, hasAudio: true, sortOrder: 0
};

describe('editorReducer', () => {
  it('adds the marked interval and exports ranges in displayed order', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222')
      .mockReturnValueOnce('33333333-3333-4333-8333-333333333333');
    let history = createInitialEditorHistory(asset.projectId, [asset]);
    history = editorReducer(history, { type: 'set-markers', markIn: 20, markOut: 30 });
    history = editorReducer(history, { type: 'add-range' });
    history = editorReducer(history, { type: 'set-markers', markIn: 2, markOut: 8 });
    history = editorReducer(history, { type: 'add-range' });

    expect(serializeExport(history.present).inputs.map(({ start, end }) => [start, end]))
      .toEqual([[20, 30], [2, 8]]);
  });

  it('limits undo history to fifty mutations', () => {
    let history = createInitialEditorHistory(asset.projectId, [asset]);
    for (let index = 0; index < 55; index += 1) {
      history = editorReducer(history, { type: 'set-crop', crop: { x: index / 1000, y: 0, width: 0.9, height: 1 } });
    }
    expect(history.past).toHaveLength(50);
  });

  it('undoes and redoes an edit without treating playhead movement as history', () => {
    let history = createInitialEditorHistory(asset.projectId, [asset]);
    history = editorReducer(history, { type: 'set-current-time', time: 8 });
    history = editorReducer(history, { type: 'set-adjustments', value: { speed: 1.5 } });
    expect(history.past).toHaveLength(1);
    history = editorReducer(history, { type: 'undo' });
    expect(history.present.adjustments.speed).toBe(1);
    history = editorReducer(history, { type: 'redo' });
    expect(history.present.adjustments.speed).toBe(1.5);
  });

  it('keeps persisted edits while incorporating newly imported assets', () => {
    const imported: EditorAsset = {
      ...asset,
      id: '44444444-4444-4444-8444-444444444444',
      name: 'novo.mp4',
      duration: 12,
      sortOrder: 1
    };
    let history = createInitialEditorHistory(asset.projectId, []);

    history = editorReducer(history, {
      type: 'hydrate',
      projectId: asset.projectId,
      assets: [imported],
      state: {
        selectedAssetId: '',
        mergeOrder: [],
        mergeRanges: {},
        sideLeftAssetId: '',
        sideRightAssetId: '',
        markOut: 0,
        adjustments: { ...history.present.adjustments, speed: 1.25 }
      }
    });

    expect(history.present.selectedAssetId).toBe(imported.id);
    expect(history.present.mergeOrder).toEqual([imported.id]);
    expect(history.present.mergeRanges[imported.id]).toEqual({ start: 0, end: 12 });
    expect(history.present.markOut).toBe(12);
    expect(history.present.adjustments.speed).toBe(1.25);
  });
});
