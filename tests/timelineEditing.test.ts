import { describe, expect, it, vi } from 'vitest';
import type { TimelineTrack } from '../shared/editorTypes';
import type { EditorAsset } from '../shared/types';
import { createDefaultTimelineTracks, hydrateTimelineTracks, moveTimelineClip, placeTimelineClip, removeTimelineClip, setTimelineClipEnabled, setTimelineIntervalEnabled, splitTimelineClip, trimTimelineClip } from '../src/editor/timelineEditing';

const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const video = (id: string, duration = 60, sortOrder = 0): EditorAsset => ({
  id, projectId, name: `${id}.mp4`, kind: 'video', duration,
  width: 1920, height: 1080, fps: 30, hasAudio: true, sortOrder
});

describe('timelineEditing', () => {
  it('creates stable video tracks and appends new imports without changing saved edits', () => {
    const image: EditorAsset = { ...video('poster', 0, 2), kind: 'image', name: 'poster.png' };

    expect(createDefaultTimelineTracks([video('a1'), image])).toEqual([{
      id: 'track-a1',
      name: 'Faixa 1',
      clips: [{
        id: 'clip-a1', assetId: 'a1', timelineStart: 0,
        sourceStart: 0, sourceEnd: 60, enabled: true
      }]
    }]);

    const saved: TimelineTrack[] = [{
      id: 'custom-track',
      name: 'Entrevista',
      clips: [{ id: 'edited', assetId: 'a1', timelineStart: 4, sourceStart: 10, sourceEnd: 20, enabled: true }]
    }, {
      id: 'missing-track',
      name: 'Removida',
      clips: [{ id: 'missing', assetId: 'gone', timelineStart: 0, sourceStart: 0, sourceEnd: 5, enabled: true }]
    }];

    expect(hydrateTimelineTracks(saved, [video('a1'), video('a2', 12, 1)])).toEqual([{
      id: 'custom-track',
      name: 'Entrevista',
      clips: [{ id: 'edited', assetId: 'a1', timelineStart: 4, sourceStart: 10, sourceEnd: 20, enabled: true }]
    }, {
      id: 'track-a2',
      name: 'Faixa 2',
      clips: [{ id: 'clip-a2', assetId: 'a2', timelineStart: 0, sourceStart: 0, sourceEnd: 12, enabled: true }]
    }]);
  });

  it('splits one clip at the global playhead while preserving source continuity', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
    const tracks = createDefaultTimelineTracks([video('a1')]);

    expect(splitTimelineClip(tracks, 'clip-a1', 20)[0].clips).toEqual([{
      id: 'clip-a1', assetId: 'a1', timelineStart: 0,
      sourceStart: 0, sourceEnd: 20, enabled: true
    }, {
      id: '22222222-2222-4222-8222-222222222222', assetId: 'a1', timelineStart: 20,
      sourceStart: 20, sourceEnd: 60, enabled: true
    }]);
  });

  it('hides only the marked middle interval and keeps both surrounding pieces active', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('33333333-3333-4333-8333-333333333333')
      .mockReturnValueOnce('44444444-4444-4444-8444-444444444444');
    const tracks = createDefaultTimelineTracks([video('a1')]);

    expect(setTimelineIntervalEnabled(tracks, 'track-a1', 20, 30, false)[0].clips).toEqual([{
      id: 'clip-a1', assetId: 'a1', timelineStart: 0,
      sourceStart: 0, sourceEnd: 20, enabled: true
    }, {
      id: '33333333-3333-4333-8333-333333333333', assetId: 'a1', timelineStart: 20,
      sourceStart: 20, sourceEnd: 30, enabled: false
    }, {
      id: '44444444-4444-4444-8444-444444444444', assetId: 'a1', timelineStart: 30,
      sourceStart: 30, sourceEnd: 60, enabled: true
    }]);
  });

  it('trims a clip edge in global time without losing its source offset', () => {
    const tracks: TimelineTrack[] = [{
      id: 't1', name: 'Faixa 1', clips: [{
        id: 'c1', assetId: 'a1', timelineStart: 10,
        sourceStart: 5, sourceEnd: 25, enabled: true
      }]
    }];

    expect(trimTimelineClip(tracks, 'c1', 'start', 14, [video('a1')])[0].clips[0]).toEqual({
      id: 'c1', assetId: 'a1', timelineStart: 14,
      sourceStart: 9, sourceEnd: 25, enabled: true
    });
  });

  it('moves a clip across tracks but rejects an overlap on the target track', () => {
    const tracks: TimelineTrack[] = [{
      id: 't1', name: 'Faixa 1', clips: [
        { id: 'c1', assetId: 'a1', timelineStart: 0, sourceStart: 0, sourceEnd: 10, enabled: true },
        { id: 'c2', assetId: 'a2', timelineStart: 20, sourceStart: 0, sourceEnd: 10, enabled: true }
      ]
    }, { id: 't2', name: 'Faixa 2', clips: [] }];
    const media = [video('a1'), video('a2')];

    expect(moveTimelineClip(tracks, 'c2', 't1', 8, media)).toBe(tracks);
    expect(moveTimelineClip(tracks, 'c2', 't2', 12, media)).toEqual([{
      id: 't1', name: 'Faixa 1', clips: [tracks[0].clips[0]]
    }, {
      id: 't2', name: 'Faixa 2', clips: [{
        id: 'c2', assetId: 'a2', timelineStart: 12, sourceStart: 0, sourceEnd: 10, enabled: true
      }]
    }]);
  });

  it('places a complete imported video at the requested time on an empty track', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce('55555555-5555-4555-8555-555555555555');
    const tracks: TimelineTrack[] = [
      { id: 't1', name: 'Faixa 1', clips: createDefaultTimelineTracks([video('a1')])[0].clips },
      { id: 't2', name: 'Faixa 2', clips: [] }
    ];

    expect(placeTimelineClip(tracks, 't1', video('a2', 12), 5)).toBe(tracks);
    expect(placeTimelineClip(tracks, 't2', video('a2', 12), 5)[1].clips).toEqual([{
      id: '55555555-5555-4555-8555-555555555555', assetId: 'a2', timelineStart: 5,
      sourceStart: 0, sourceEnd: 12, enabled: true
    }]);
  });

  it('toggles one clip without mutating its timing', () => {
    const tracks = createDefaultTimelineTracks([video('a1')]);

    expect(setTimelineClipEnabled(tracks, 'clip-a1', false)[0].clips[0]).toEqual({
      ...tracks[0].clips[0],
      enabled: false
    });
  });

  it('removes only the referenced clip and preserves its track', () => {
    const tracks = createDefaultTimelineTracks([video('a1'), video('a2')]);

    expect(removeTimelineClip(tracks, 'clip-a1')).toEqual([{
      ...tracks[0],
      clips: []
    }, tracks[1]]);
  });
});
