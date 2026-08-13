import type { EditorAsset } from './types';
import type { ResolvedTimelineSegment, TimelineLayerClip, TimelineTrack } from './editorTypes';

const precision = (value: number) => Math.round(value * 1000) / 1000;
const clipEnd = (clip: TimelineLayerClip) => clip.timelineStart + clip.sourceEnd - clip.sourceStart;

export function timelineDuration(tracks: TimelineTrack[]): number {
  let duration = 0;
  for (const track of tracks) {
    for (const clip of track.clips) duration = Math.max(duration, clipEnd(clip));
  }
  return precision(duration);
}

export function resolveTimeline(tracks: TimelineTrack[], assets: EditorAsset[]): ResolvedTimelineSegment[] {
  const assetsById = new Map(assets.filter(({ kind }) => kind !== 'image').map((asset) => [asset.id, asset]));
  const validClip = (clip: TimelineLayerClip) => {
    const asset = assetsById.get(clip.assetId);
    return Boolean(asset
      && clip.enabled
      && clip.timelineStart >= 0
      && clip.sourceStart >= 0
      && clip.sourceEnd > clip.sourceStart
      && clip.sourceEnd <= asset.duration + 0.001);
  };
  const enabled = tracks.flatMap((track) => track.clips
    .filter(validClip)
    .map((clip) => ({ track, clip, end: clipEnd(clip) }))
    .filter(({ clip, end }) => clip.timelineStart >= 0 && end > clip.timelineStart));
  const boundaries = [...new Set(enabled.flatMap(({ clip, end }) => [precision(clip.timelineStart), precision(end)]))]
    .sort((left, right) => left - right);
  const segments: ResolvedTimelineSegment[] = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const timelineStart = boundaries[index];
    const timelineEnd = boundaries[index + 1];
    if (timelineEnd <= timelineStart) continue;
    const midpoint = timelineStart + (timelineEnd - timelineStart) / 2;
    let winner: { track: TimelineTrack; clip: TimelineLayerClip } | undefined;
    for (const track of tracks) {
      const clip = track.clips.find((candidate) => validClip(candidate)
        && candidate.timelineStart <= midpoint
        && clipEnd(candidate) > midpoint);
      if (clip) { winner = { track, clip }; break; }
    }
    if (!winner) continue;
    const sourceStart = precision(winner.clip.sourceStart + timelineStart - winner.clip.timelineStart);
    const sourceEnd = precision(sourceStart + timelineEnd - timelineStart);
    const previous = segments.at(-1);
    if (previous
      && previous.trackId === winner.track.id
      && previous.clipId === winner.clip.id
      && previous.timelineEnd === timelineStart
      && previous.sourceEnd === sourceStart) {
      previous.timelineEnd = timelineEnd;
      previous.sourceEnd = sourceEnd;
      continue;
    }
    segments.push({
      trackId: winner.track.id,
      clipId: winner.clip.id,
      assetId: winner.clip.assetId,
      timelineStart,
      timelineEnd,
      sourceStart,
      sourceEnd
    });
  }
  return segments;
}

export function timelineSegmentAt(segments: ResolvedTimelineSegment[], time: number): ResolvedTimelineSegment | undefined {
  return segments.find((segment, index) => segment.timelineStart <= time
    && (time < segment.timelineEnd || (index === segments.length - 1 && time === segment.timelineEnd)));
}
