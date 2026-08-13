import type { TimelineLayerClip, TimelineTrack } from '../../shared/editorTypes';
import type { EditorAsset } from '../../shared/types';

const videoAssets = (assets: EditorAsset[]) => assets.filter(({ kind }) => kind !== 'image');

function defaultTrack(asset: EditorAsset, index: number): TimelineTrack {
  return {
    id: `track-${asset.id}`,
    name: `Faixa ${index + 1}`,
    clips: [{
      id: `clip-${asset.id}`,
      assetId: asset.id,
      timelineStart: 0,
      sourceStart: 0,
      sourceEnd: asset.duration,
      enabled: true
    }]
  };
}

export function createDefaultTimelineTracks(assets: EditorAsset[]): TimelineTrack[] {
  return videoAssets(assets).map(defaultTrack);
}

export function hydrateTimelineTracks(saved: TimelineTrack[] | undefined, assets: EditorAsset[]): TimelineTrack[] {
  if (!saved?.length) return createDefaultTimelineTracks(assets);
  const byId = new Map(videoAssets(assets).map((asset) => [asset.id, asset]));
  const tracks = saved.flatMap((track) => {
    const clips = track.clips.filter((clip) => {
      const asset = byId.get(clip.assetId);
      return Boolean(asset
        && clip.timelineStart >= 0
        && clip.sourceStart >= 0
        && clip.sourceEnd > clip.sourceStart
        && clip.sourceEnd <= asset.duration + 0.001);
    });
    return clips.length ? [{ ...track, clips }] : [];
  });
  const used = new Set(tracks.flatMap(({ clips }) => clips.map(({ assetId }) => assetId)));
  for (const asset of videoAssets(assets)) {
    if (!used.has(asset.id)) tracks.push(defaultTrack(asset, tracks.length));
  }
  return tracks;
}

export function splitTimelineClip(tracks: TimelineTrack[], clipId: string, globalTime: number): TimelineTrack[] {
  for (const track of tracks) {
    const index = track.clips.findIndex(({ id }) => id === clipId);
    if (index < 0) continue;
    const clip = track.clips[index];
    const end = clip.timelineStart + clip.sourceEnd - clip.sourceStart;
    if (globalTime <= clip.timelineStart || globalTime >= end) return tracks;
    const sourceSplit = Math.round((clip.sourceStart + globalTime - clip.timelineStart) * 1000) / 1000;
    const left: TimelineLayerClip = { ...clip, sourceEnd: sourceSplit };
    const right: TimelineLayerClip = {
      ...clip,
      id: crypto.randomUUID(),
      timelineStart: Math.round(globalTime * 1000) / 1000,
      sourceStart: sourceSplit
    };
    const clips = [...track.clips];
    clips.splice(index, 1, left, right);
    return tracks.map((item) => item.id === track.id ? { ...item, clips } : item);
  }
  return tracks;
}

export function setTimelineIntervalEnabled(
  tracks: TimelineTrack[],
  trackId: string,
  globalStart: number,
  globalEnd: number,
  enabled: boolean
): TimelineTrack[] {
  if (globalEnd <= globalStart) return tracks;
  const track = tracks.find(({ id }) => id === trackId);
  if (!track) return tracks;
  let changed = false;
  const clips = track.clips.flatMap((clip) => {
    const clipStart = clip.timelineStart;
    const clipEnd = clipStart + clip.sourceEnd - clip.sourceStart;
    const overlapStart = Math.max(clipStart, globalStart);
    const overlapEnd = Math.min(clipEnd, globalEnd);
    if (overlapEnd <= overlapStart) return [clip];
    changed = true;
    const sourceAt = (time: number) => Math.round((clip.sourceStart + time - clipStart) * 1000) / 1000;
    const pieces: TimelineLayerClip[] = [];
    if (clipStart < overlapStart) pieces.push({ ...clip, sourceEnd: sourceAt(overlapStart) });
    pieces.push({
      ...clip,
      id: pieces.length ? crypto.randomUUID() : clip.id,
      timelineStart: Math.round(overlapStart * 1000) / 1000,
      sourceStart: sourceAt(overlapStart),
      sourceEnd: sourceAt(overlapEnd),
      enabled
    });
    if (overlapEnd < clipEnd) pieces.push({
      ...clip,
      id: crypto.randomUUID(),
      timelineStart: Math.round(overlapEnd * 1000) / 1000,
      sourceStart: sourceAt(overlapEnd)
    });
    return pieces;
  });
  return changed ? tracks.map((item) => item.id === track.id ? { ...item, clips } : item) : tracks;
}

export function trimTimelineClip(
  tracks: TimelineTrack[],
  clipId: string,
  edge: 'start' | 'end',
  globalTime: number,
  assets: EditorAsset[]
): TimelineTrack[] {
  for (const track of tracks) {
    const clip = track.clips.find(({ id }) => id === clipId);
    if (!clip) continue;
    const asset = assets.find(({ id }) => id === clip.assetId);
    if (!asset) return tracks;
    const minimum = asset.fps > 0 ? 1 / asset.fps : 0.01;
    const currentEnd = clip.timelineStart + clip.sourceEnd - clip.sourceStart;
    let next = clip;
    if (edge === 'start') {
      const start = Math.min(currentEnd - minimum, Math.max(clip.timelineStart - clip.sourceStart, globalTime));
      next = {
        ...clip,
        timelineStart: Math.round(start * 1000) / 1000,
        sourceStart: Math.round((clip.sourceStart + start - clip.timelineStart) * 1000) / 1000
      };
    } else {
      const end = Math.max(clip.timelineStart + minimum, Math.min(clip.timelineStart + asset.duration - clip.sourceStart, globalTime));
      next = { ...clip, sourceEnd: Math.round((clip.sourceStart + end - clip.timelineStart) * 1000) / 1000 };
    }
    return tracks.map((item) => item.id === track.id
      ? { ...item, clips: item.clips.map((candidate) => candidate.id === clip.id ? next : candidate) }
      : item);
  }
  return tracks;
}

export function moveTimelineClip(
  tracks: TimelineTrack[],
  clipId: string,
  targetTrackId: string,
  timelineStart: number,
  assets: EditorAsset[]
): TimelineTrack[] {
  const sourceTrack = tracks.find((track) => track.clips.some(({ id }) => id === clipId));
  const targetTrack = tracks.find(({ id }) => id === targetTrackId);
  const clip = sourceTrack?.clips.find(({ id }) => id === clipId);
  if (!sourceTrack || !targetTrack || !clip || !assets.some(({ id }) => id === clip.assetId)) return tracks;
  const start = Math.max(0, Math.round(timelineStart * 1000) / 1000);
  const end = start + clip.sourceEnd - clip.sourceStart;
  const overlaps = targetTrack.clips.some((candidate) => {
    if (candidate.id === clip.id) return false;
    const candidateEnd = candidate.timelineStart + candidate.sourceEnd - candidate.sourceStart;
    return start < candidateEnd && end > candidate.timelineStart;
  });
  if (overlaps) return tracks;
  const moved = { ...clip, timelineStart: start };
  return tracks.map((track) => {
    const without = track.clips.filter(({ id }) => id !== clip.id);
    if (track.id !== targetTrack.id) return without.length === track.clips.length ? track : { ...track, clips: without };
    return { ...track, clips: [...without, moved].sort((left, right) => left.timelineStart - right.timelineStart) };
  });
}

export function placeTimelineClip(
  tracks: TimelineTrack[],
  trackId: string,
  asset: EditorAsset,
  timelineStart: number
): TimelineTrack[] {
  const track = tracks.find(({ id }) => id === trackId);
  if (!track || asset.kind === 'image' || asset.duration <= 0) return tracks;
  const start = Math.max(0, Math.round(timelineStart * 1000) / 1000);
  const end = start + asset.duration;
  if (track.clips.some((clip) => {
    const clipEnd = clip.timelineStart + clip.sourceEnd - clip.sourceStart;
    return start < clipEnd && end > clip.timelineStart;
  })) return tracks;
  const clip: TimelineLayerClip = {
    id: crypto.randomUUID(),
    assetId: asset.id,
    timelineStart: start,
    sourceStart: 0,
    sourceEnd: asset.duration,
    enabled: true
  };
  return tracks.map((item) => item.id === track.id
    ? { ...item, clips: [...item.clips, clip].sort((left, right) => left.timelineStart - right.timelineStart) }
    : item);
}

export function setTimelineClipEnabled(tracks: TimelineTrack[], clipId: string, enabled: boolean): TimelineTrack[] {
  const track = tracks.find((item) => item.clips.some(({ id }) => id === clipId));
  if (!track) return tracks;
  return tracks.map((item) => item.id === track.id ? {
    ...item,
    clips: item.clips.map((clip) => clip.id === clipId ? { ...clip, enabled } : clip)
  } : item);
}

export function removeTimelineClip(tracks: TimelineTrack[], clipId: string): TimelineTrack[] {
  const track = tracks.find((item) => item.clips.some(({ id }) => id === clipId));
  return track ? tracks.map((item) => item.id === track.id
    ? { ...item, clips: item.clips.filter(({ id }) => id !== clipId) }
    : item) : tracks;
}
