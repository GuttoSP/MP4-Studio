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
  it('initializes stable layered tracks and records structural edits in undo history', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
    let history = createInitialEditorHistory(asset.projectId, [asset]);

    expect(history.present.tracks).toEqual([{
      id: `track-${asset.id}`,
      name: 'Faixa 1',
      clips: [{
        id: `clip-${asset.id}`, assetId: asset.id, timelineStart: 0,
        sourceStart: 0, sourceEnd: 45, enabled: true
      }]
    }]);
    expect(history.present.selectedTrackId).toBe(`track-${asset.id}`);
    expect(history.present.selectedClipId).toBe(`clip-${asset.id}`);
    expect(history.present.tab).toBe('timeline');

    history = editorReducer(history, { type: 'split-timeline-clip', clipId: `clip-${asset.id}`, time: 20 });
    expect(history.present.tracks[0].clips.map(({ sourceStart, sourceEnd }) => [sourceStart, sourceEnd]))
      .toEqual([[0, 20], [20, 45]]);
    expect(history.past).toHaveLength(1);
    history = editorReducer(history, { type: 'undo' });
    expect(history.present.tracks[0].clips).toHaveLength(1);
  });
  it('persists timeline zoom as one undoable edit', () => {
    let history = createInitialEditorHistory(asset.projectId, [asset]);
    history = editorReducer(history, { type: 'set-timeline-zoom', zoom: 2.5 });
    expect(history.present.timelineZoom).toBe(2.5);
    expect(history.past).toHaveLength(1);
    history = editorReducer(history, { type: 'set-timeline-zoom', zoom: 9 });
    expect(history.present.timelineZoom).toBe(4);
  });
  it('trims and reorders ranges atomically', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222')
      .mockReturnValueOnce('33333333-3333-4333-8333-333333333333');
    let history = createInitialEditorHistory(asset.projectId, [asset]);
    history = editorReducer(history, { type: 'set-markers', markIn: 1, markOut: 5 });
    history = editorReducer(history, { type: 'add-range' });
    history = editorReducer(history, { type: 'set-markers', markIn: 8, markOut: 12 });
    history = editorReducer(history, { type: 'add-range' });
    const beforeTrimHistory = history.past.length;
    history = editorReducer(history, { type: 'commit-range-trim', id: history.present.ranges[0].id, start: 2, end: 6 });
    expect(history.present.ranges[0]).toMatchObject({ start: 2, end: 6 });
    expect(history.past).toHaveLength(beforeTrimHistory + 1);
    history = editorReducer(history, { type: 'reorder-range', id: history.present.ranges[1].id, beforeId: history.present.ranges[0].id });
    expect(history.present.ranges.map(({ start }) => start)).toEqual([8, 2]);
  });
  it('adds the marked interval and exports ranges in displayed order', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222')
      .mockReturnValueOnce('33333333-3333-4333-8333-333333333333');
    let history = createInitialEditorHistory(asset.projectId, [asset]);
    history = editorReducer(history, { type: 'set-markers', markIn: 20, markOut: 30 });
    history = editorReducer(history, { type: 'add-range' });
    history = editorReducer(history, { type: 'set-markers', markIn: 2, markOut: 8 });
    history = editorReducer(history, { type: 'add-range' });
    history = editorReducer(history, { type: 'set-tab', tab: 'cut' });

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

  it('routes layered clip edits through undoable reducer actions', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('33333333-3333-4333-8333-333333333333')
      .mockReturnValueOnce('44444444-4444-4444-8444-444444444444');
    let history = createInitialEditorHistory(asset.projectId, [asset]);

    history = editorReducer(history, { type: 'add-timeline-track' });
    history = editorReducer(history, { type: 'rename-timeline-track', trackId: '33333333-3333-4333-8333-333333333333', name: 'Cobertura' });
    history = editorReducer(history, { type: 'place-timeline-clip', trackId: '33333333-3333-4333-8333-333333333333', assetId: asset.id, timelineStart: 50 });
    history = editorReducer(history, { type: 'trim-timeline-clip', clipId: '44444444-4444-4444-8444-444444444444', edge: 'end', time: 60 });
    history = editorReducer(history, { type: 'move-timeline-clip', clipId: '44444444-4444-4444-8444-444444444444', trackId: `track-${asset.id}`, timelineStart: 46 });
    history = editorReducer(history, { type: 'set-timeline-clip-enabled', clipId: '44444444-4444-4444-8444-444444444444', enabled: false });

    expect(history.present.tracks[0].clips[1]).toMatchObject({
      id: '44444444-4444-4444-8444-444444444444', timelineStart: 46, sourceStart: 0, sourceEnd: 10, enabled: false
    });
    expect(history.past.length).toBeGreaterThanOrEqual(6);

    history = editorReducer(history, { type: 'remove-timeline-clip', clipId: '44444444-4444-4444-8444-444444444444' });
    expect(history.present.tracks[0].clips.map(({ id }) => id)).toEqual([`clip-${asset.id}`]);
    history = editorReducer(history, { type: 'reorder-timeline-track', trackId: '33333333-3333-4333-8333-333333333333', direction: -1 });
    expect(history.present.tracks.map(({ id }) => id)).toEqual(['33333333-3333-4333-8333-333333333333', `track-${asset.id}`]);
  });

  it('hides a marked interval and keeps selection out of undo history', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('55555555-5555-4555-8555-555555555555')
      .mockReturnValueOnce('66666666-6666-4666-8666-666666666666');
    let history = createInitialEditorHistory(asset.projectId, [asset]);
    history = editorReducer(history, {
      type: 'hide-timeline-interval',
      trackId: `track-${asset.id}`,
      start: 20,
      end: 30
    });
    expect(history.present.tracks[0].clips.map(({ enabled }) => enabled)).toEqual([true, false, true]);
    const mutations = history.past.length;
    history = editorReducer(history, { type: 'select-timeline-clip', trackId: `track-${asset.id}`, clipId: '55555555-5555-4555-8555-555555555555' });
    expect(history.present.selectedClipId).toBe('55555555-5555-4555-8555-555555555555');
    expect(history.past).toHaveLength(mutations);
  });

  it('serializes only the visible winners of a layered timeline', () => {
    const second = {
      ...asset,
      id: '22222222-2222-4222-8222-222222222222',
      name: 'plano-dois.mp4'
    };
    const third = {
      ...asset,
      id: '33333333-3333-4333-8333-333333333333',
      name: 'plano-tres.mp4'
    };
    let history = createInitialEditorHistory(asset.projectId, [asset, second, third]);

    history = editorReducer(history, {
      type: 'hydrate',
      projectId: asset.projectId,
      assets: [asset, second, third],
      state: {
        tab: 'timeline',
        tracks: [
          {
            id: 'track-top', name: 'Principal', clips: [
              { id: 'clip-top', assetId: asset.id, timelineStart: 0, sourceStart: 0, sourceEnd: 10, enabled: true }
            ]
          },
          {
            id: 'track-middle', name: 'Cobertura', clips: [
              { id: 'clip-middle-a', assetId: second.id, timelineStart: 0, sourceStart: 0, sourceEnd: 20, enabled: true },
              { id: 'clip-middle-gap', assetId: second.id, timelineStart: 20, sourceStart: 20, sourceEnd: 30, enabled: false },
              { id: 'clip-middle-b', assetId: second.id, timelineStart: 30, sourceStart: 30, sourceEnd: 45, enabled: true }
            ]
          },
          {
            id: 'track-bottom', name: 'Base', clips: [
              { id: 'clip-bottom', assetId: third.id, timelineStart: 0, sourceStart: 0, sourceEnd: 45, enabled: true }
            ]
          }
        ],
        timelineTransition: { type: 'none', duration: 0 }
      }
    });

    expect(serializeExport(history.present)).toMatchObject({
      operation: 'timeline',
      inputs: [
        { assetId: asset.id, start: 0, end: 10 },
        { assetId: second.id, start: 10, end: 20 },
        { assetId: third.id, start: 20, end: 30 },
        { assetId: second.id, start: 30, end: 45 }
      ],
      transition: { type: 'none', duration: 0 }
    });
  });
});
