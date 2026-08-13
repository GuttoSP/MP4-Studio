import { describe, expect, it } from 'vitest';
import { resolveTimeline, timelineDuration, timelineSegmentAt } from '../shared/timelineComposition';
import type { EditorAsset } from '../shared/types';

const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const assets: EditorAsset[] = ['a1', 'a2', 'a3'].map((id, sortOrder) => ({
  id,
  projectId,
  name: `${id}.mp4`,
  kind: 'video',
  duration: 60,
  width: 1920,
  height: 1080,
  fps: 30,
  hasAudio: true,
  sortOrder
}));

const clip = (id: string, assetId: string, timelineStart: number, sourceStart: number, sourceEnd: number) => ({
  id,
  assetId,
  timelineStart,
  sourceStart,
  sourceEnd,
  enabled: true
});

const track = (id: string, ...clips: ReturnType<typeof clip>[]) => ({ id, name: id, clips });

describe('resolveTimeline', () => {
  it('reveals lower tracks only where every higher track is transparent', () => {
    const tracks = [
      track('t1', clip('c1', 'a1', 0, 0, 10)),
      track('t2', clip('c2a', 'a2', 0, 0, 20), clip('c2b', 'a2', 30, 30, 60)),
      track('t3', clip('c3', 'a3', 0, 0, 60))
    ];

    expect(resolveTimeline(tracks, assets).map(({ assetId, timelineStart, timelineEnd, sourceStart, sourceEnd }) => ({
      assetId,
      timelineStart,
      timelineEnd,
      sourceStart,
      sourceEnd
    }))).toEqual([
      { assetId: 'a1', timelineStart: 0, timelineEnd: 10, sourceStart: 0, sourceEnd: 10 },
      { assetId: 'a2', timelineStart: 10, timelineEnd: 20, sourceStart: 10, sourceEnd: 20 },
      { assetId: 'a3', timelineStart: 20, timelineEnd: 30, sourceStart: 20, sourceEnd: 30 },
      { assetId: 'a2', timelineStart: 30, timelineEnd: 60, sourceStart: 30, sourceEnd: 60 }
    ]);
  });

  it('uses the furthest clip end as the global duration', () => {
    const tracks = [
      track('t1', clip('c1', 'a1', 4, 2, 12)),
      track('t2', clip('c2', 'a2', 30, 10, 25))
    ];

    expect(timelineDuration(tracks)).toBe(45);
  });

  it('selects one deterministic winner on an exact boundary', () => {
    const segments = resolveTimeline([
      track('t1', clip('c1', 'a1', 0, 0, 10)),
      track('t2', clip('c2', 'a2', 0, 0, 60))
    ], assets);

    expect(timelineSegmentAt(segments, 9.999)?.assetId).toBe('a1');
    expect(timelineSegmentAt(segments, 10)?.assetId).toBe('a2');
    expect(timelineSegmentAt(segments, 60)?.assetId).toBe('a2');
  });

  it('ignores disabled, missing and out-of-bounds source clips', () => {
    const disabled = { ...clip('disabled', 'a1', 0, 0, 60), enabled: false };
    const tracks = [
      track('t1', disabled, clip('missing', 'not-in-project', 0, 0, 60), clip('invalid', 'a1', 0, -1, 10)),
      track('t2', clip('valid', 'a2', 0, 0, 5))
    ];

    expect(resolveTimeline(tracks, assets)).toEqual([{
      trackId: 't2', clipId: 'valid', assetId: 'a2',
      timelineStart: 0, timelineEnd: 5, sourceStart: 0, sourceEnd: 5
    }]);
  });
});
