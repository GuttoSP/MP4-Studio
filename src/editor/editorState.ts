import type { EditorAsset } from '../../shared/types';
import type { Adjustments, EditorTab, ExportRequest, GifSettings, OutputSettings, SideBySideSettings, TimelineTrack, TimelineTransition } from '../../shared/editorTypes';
import { resolveTimeline } from '../../shared/timelineComposition';
import {
  createDefaultTimelineTracks,
  hydrateTimelineTracks,
  moveTimelineClip,
  placeTimelineClip,
  removeTimelineClip,
  setTimelineClipEnabled,
  setTimelineIntervalEnabled,
  splitTimelineClip,
  trimTimelineClip
} from './timelineEditing';

export type EditorRange = { id: string; assetId: string; start: number; end: number };
export type EditorState = {
  projectId: string;
  assets: EditorAsset[];
  selectedAssetId: string;
  currentTime: number;
  timelineZoom: number;
  markIn: number;
  markOut: number;
  tab: EditorTab;
  tracks: TimelineTrack[];
  selectedTrackId: string;
  selectedClipId: string;
  timelineTransition: TimelineTransition;
  ranges: EditorRange[];
  mergeOrder: string[];
  mergeRanges: Record<string, { start: number; end: number }>;
  sideLeftAssetId: string;
  sideRightAssetId: string;
  adjustments: Adjustments;
  output: OutputSettings;
  sideBySide: SideBySideSettings;
  frame: { format: 'png' | 'jpg' | 'webp'; height: OutputSettings['height'] };
  gif: GifSettings & { start: number; end: number };
};
export type EditorHistory = { present: EditorState; past: EditorState[]; future: EditorState[] };
export type EditorAction =
  | { type: 'hydrate'; projectId: string; assets: EditorAsset[]; state?: Partial<EditorState> }
  | { type: 'select-asset'; assetId: string }
  | { type: 'set-current-time'; time: number }
  | { type: 'set-timeline-zoom'; zoom: number }
  | { type: 'split-timeline-clip'; clipId: string; time: number }
  | { type: 'hide-timeline-interval'; trackId: string; start: number; end: number }
  | { type: 'set-timeline-clip-enabled'; clipId: string; enabled: boolean }
  | { type: 'remove-timeline-clip'; clipId: string }
  | { type: 'trim-timeline-clip'; clipId: string; edge: 'start' | 'end'; time: number }
  | { type: 'move-timeline-clip'; clipId: string; trackId: string; timelineStart: number }
  | { type: 'place-timeline-clip'; trackId: string; assetId: string; timelineStart: number }
  | { type: 'select-timeline-clip'; trackId: string; clipId: string }
  | { type: 'add-timeline-track' }
  | { type: 'rename-timeline-track'; trackId: string; name: string }
  | { type: 'reorder-timeline-track'; trackId: string; direction: -1 | 1 }
  | { type: 'set-timeline-transition'; value: TimelineTransition }
  | { type: 'set-markers'; markIn: number; markOut: number }
  | { type: 'add-range' }
  | { type: 'remove-range'; id: string }
  | { type: 'update-range'; id: string; start: number; end: number }
  | { type: 'commit-range-trim'; id: string; start: number; end: number }
  | { type: 'reorder-range'; id: string; beforeId: string }
  | { type: 'insert-range'; assetId: string }
  | { type: 'move-range'; id: string; direction: -1 | 1 }
  | { type: 'set-tab'; tab: EditorTab }
  | { type: 'set-crop'; crop: Adjustments['crop'] }
  | { type: 'set-adjustments'; value: Partial<Adjustments> }
  | { type: 'set-output'; value: Partial<OutputSettings> }
  | { type: 'set-merge-order'; value: string[] }
  | { type: 'set-merge-range'; assetId: string; start: number; end: number }
  | { type: 'set-side-assets'; left: string; right: string }
  | { type: 'set-side-settings'; value: Partial<SideBySideSettings> }
  | { type: 'set-frame'; value: Partial<EditorState['frame']> }
  | { type: 'set-gif'; value: Partial<EditorState['gif']> }
  | { type: 'undo' } | { type: 'redo' };

const defaultAdjustments: Adjustments = { crop: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0, flipHorizontal: false, flipVertical: false, speed: 1, muted: false, volume: 1 };
const defaultOutput: OutputSettings = { height: 0, fps: 0, quality: 'balanced' };
const defaultSide: SideBySideSettings = { aspect: '16:9', divider: 0.5, leftFit: 'contain', rightFit: 'contain', leftPanX: 0.5, leftPanY: 0.5, rightPanX: 0.5, rightPanY: 0.5, durationPolicy: 'shortest', audio: 'first' };

function initialState(projectId: string, assets: EditorAsset[]): EditorState {
  const selected = assets.find((asset) => asset.kind !== 'image') ?? assets[0];
  const videos = assets.filter((asset) => asset.kind !== 'image');
  const tracks = createDefaultTimelineTracks(assets);
  return {
    projectId, assets, selectedAssetId: selected?.id ?? '', currentTime: 0, timelineZoom: 1, markIn: 0, markOut: selected?.duration ?? 0,
    tab: 'timeline', tracks, selectedTrackId: tracks[0]?.id ?? '', selectedClipId: tracks[0]?.clips[0]?.id ?? '', timelineTransition: { type: 'none', duration: 0 }, ranges: [], mergeOrder: videos.map(({ id }) => id),
    mergeRanges: Object.fromEntries(videos.map((asset) => [asset.id, { start: 0, end: asset.duration }])),
    sideLeftAssetId: assets[0]?.id ?? '', sideRightAssetId: assets[1]?.id ?? '',
    adjustments: structuredClone(defaultAdjustments), output: { ...defaultOutput }, sideBySide: { ...defaultSide },
    frame: { format: 'png', height: 0 }, gif: { start: 0, end: Math.min(selected?.duration ?? 0, 5), width: 640, fps: 15, loop: true, quality: 'balanced' }
  };
}

export function createInitialEditorHistory(projectId = '', assets: EditorAsset[] = []): EditorHistory {
  return { present: initialState(projectId, assets), past: [], future: [] };
}

function selectedAsset(state: EditorState) { return state.assets.find((asset) => asset.id === state.selectedAssetId); }

function reduce(state: EditorState, action: Exclude<EditorAction, { type: 'undo' | 'redo' }>): EditorState {
  if (action.type === 'hydrate') {
    const fresh = initialState(action.projectId, action.assets);
    if (!action.state) return fresh;
    const assetIds = new Set(action.assets.map(({ id }) => id));
    const videoIds = action.assets.filter(({ kind }) => kind !== 'image').map(({ id }) => id);
    const savedOrder = (action.state.mergeOrder ?? []).filter((id) => videoIds.includes(id));
    const mergeOrder = [...savedOrder, ...videoIds.filter((id) => !savedOrder.includes(id))];
    const persistedSelection = Boolean(action.state.selectedAssetId && assetIds.has(action.state.selectedAssetId));
    const selectedAssetId = persistedSelection ? action.state.selectedAssetId! : fresh.selectedAssetId;
    const sideLeftAssetId = action.state.sideLeftAssetId && assetIds.has(action.state.sideLeftAssetId) ? action.state.sideLeftAssetId : fresh.sideLeftAssetId;
    const sideRightAssetId = action.state.sideRightAssetId && assetIds.has(action.state.sideRightAssetId) ? action.state.sideRightAssetId : fresh.sideRightAssetId;
    const tracks = hydrateTimelineTracks(action.state.tracks, action.assets);
    const persistedClip = tracks.flatMap(({ clips }) => clips).find(({ id }) => id === action.state?.selectedClipId);
    const selectedTrack = tracks.find(({ id }) => id === action.state?.selectedTrackId && (!persistedClip || id === tracks.find((track) => track.clips.some(({ id: clipId }) => clipId === persistedClip.id))?.id));
    return {
      ...fresh,
      ...action.state,
      projectId: action.projectId,
      assets: action.assets,
      selectedAssetId,
      currentTime: persistedSelection ? action.state.currentTime ?? fresh.currentTime : fresh.currentTime,
      timelineZoom: Math.min(4, Math.max(1, action.state.timelineZoom ?? fresh.timelineZoom)),
      markIn: persistedSelection ? action.state.markIn ?? fresh.markIn : fresh.markIn,
      markOut: persistedSelection ? action.state.markOut ?? fresh.markOut : fresh.markOut,
      tracks,
      selectedTrackId: selectedTrack?.id ?? tracks.find((track) => track.clips.some(({ id }) => id === persistedClip?.id))?.id ?? tracks[0]?.id ?? '',
      selectedClipId: persistedClip?.id ?? tracks[0]?.clips[0]?.id ?? '',
      timelineTransition: { ...fresh.timelineTransition, ...action.state.timelineTransition },
      ranges: (action.state.ranges ?? fresh.ranges).filter(({ assetId }) => assetIds.has(assetId)),
      mergeOrder,
      mergeRanges: Object.fromEntries(videoIds.map((id) => [id, action.state?.mergeRanges?.[id] ?? fresh.mergeRanges[id]])),
      sideLeftAssetId,
      sideRightAssetId,
      gif: persistedSelection
        ? { ...fresh.gif, ...action.state.gif }
        : { ...fresh.gif, ...action.state.gif, start: fresh.gif.start, end: fresh.gif.end },
      adjustments: { ...fresh.adjustments, ...action.state.adjustments, crop: action.state.adjustments?.crop ?? fresh.adjustments.crop },
      output: { ...fresh.output, ...action.state.output },
      sideBySide: { ...fresh.sideBySide, ...action.state.sideBySide },
      frame: { ...fresh.frame, ...action.state.frame }
    };
  }
  if (action.type === 'select-asset') {
    const asset = state.assets.find(({ id }) => id === action.assetId);
    return asset ? { ...state, selectedAssetId: asset.id, currentTime: 0, markIn: 0, markOut: asset.duration, gif: { ...state.gif, start: 0, end: Math.min(asset.duration, 5) } } : state;
  }
  if (action.type === 'set-current-time') return { ...state, currentTime: Math.max(0, action.time) };
  if (action.type === 'set-timeline-zoom') return { ...state, timelineZoom: Math.min(4, Math.max(1, action.zoom)) };
  if (action.type === 'split-timeline-clip') {
    const tracks = splitTimelineClip(state.tracks, action.clipId, action.time);
    return tracks === state.tracks ? state : { ...state, tracks };
  }
  if (action.type === 'hide-timeline-interval') {
    const tracks = setTimelineIntervalEnabled(state.tracks, action.trackId, action.start, action.end, false);
    return tracks === state.tracks ? state : { ...state, tracks };
  }
  if (action.type === 'set-timeline-clip-enabled') {
    const tracks = setTimelineClipEnabled(state.tracks, action.clipId, action.enabled);
    return tracks === state.tracks ? state : { ...state, tracks };
  }
  if (action.type === 'remove-timeline-clip') {
    const tracks = removeTimelineClip(state.tracks, action.clipId);
    if (tracks === state.tracks) return state;
    const selectedClipId = state.selectedClipId === action.clipId ? tracks.flatMap(({ clips }) => clips)[0]?.id ?? '' : state.selectedClipId;
    const selectedTrackId = tracks.find((track) => track.clips.some(({ id }) => id === selectedClipId))?.id ?? state.selectedTrackId;
    return { ...state, tracks, selectedClipId, selectedTrackId };
  }
  if (action.type === 'trim-timeline-clip') {
    const tracks = trimTimelineClip(state.tracks, action.clipId, action.edge, action.time, state.assets);
    return tracks === state.tracks ? state : { ...state, tracks };
  }
  if (action.type === 'move-timeline-clip') {
    const tracks = moveTimelineClip(state.tracks, action.clipId, action.trackId, action.timelineStart, state.assets);
    return tracks === state.tracks ? state : { ...state, tracks, selectedTrackId: action.trackId, selectedClipId: action.clipId };
  }
  if (action.type === 'place-timeline-clip') {
    const asset = state.assets.find(({ id }) => id === action.assetId);
    if (!asset) return state;
    const tracks = placeTimelineClip(state.tracks, action.trackId, asset, action.timelineStart);
    if (tracks === state.tracks) return state;
    const previous = new Set(state.tracks.flatMap(({ clips }) => clips.map(({ id }) => id)));
    const selectedClipId = tracks.flatMap(({ clips }) => clips).find(({ id }) => !previous.has(id))?.id ?? state.selectedClipId;
    return { ...state, tracks, selectedTrackId: action.trackId, selectedClipId };
  }
  if (action.type === 'select-timeline-clip') {
    const track = state.tracks.find(({ id }) => id === action.trackId);
    return track?.clips.some(({ id }) => id === action.clipId)
      ? { ...state, selectedTrackId: track.id, selectedClipId: action.clipId }
      : state;
  }
  if (action.type === 'add-timeline-track') {
    const id = crypto.randomUUID();
    return { ...state, tracks: [...state.tracks, { id, name: `Faixa ${state.tracks.length + 1}`, clips: [] }], selectedTrackId: id, selectedClipId: '' };
  }
  if (action.type === 'rename-timeline-track') {
    const name = action.name.trim();
    if (!name || !state.tracks.some(({ id }) => id === action.trackId)) return state;
    return { ...state, tracks: state.tracks.map((track) => track.id === action.trackId ? { ...track, name } : track) };
  }
  if (action.type === 'reorder-timeline-track') {
    const index = state.tracks.findIndex(({ id }) => id === action.trackId);
    const target = index + action.direction;
    if (index < 0 || target < 0 || target >= state.tracks.length) return state;
    const tracks = [...state.tracks];
    [tracks[index], tracks[target]] = [tracks[target], tracks[index]];
    return { ...state, tracks };
  }
  if (action.type === 'set-timeline-transition') return { ...state, timelineTransition: action.value };
  if (action.type === 'set-markers') return { ...state, markIn: Math.max(0, action.markIn), markOut: Math.max(0, action.markOut) };
  if (action.type === 'add-range') {
    const asset = selectedAsset(state);
    if (!asset || asset.kind === 'image' || state.markOut <= state.markIn || state.markOut > asset.duration) return state;
    return { ...state, ranges: [...state.ranges, { id: crypto.randomUUID(), assetId: asset.id, start: Math.round(state.markIn * 1000) / 1000, end: Math.round(state.markOut * 1000) / 1000 }] };
  }
  if (action.type === 'remove-range') return { ...state, ranges: state.ranges.filter(({ id }) => id !== action.id) };
  if (action.type === 'update-range') return { ...state, ranges: state.ranges.map((range) => range.id === action.id ? { ...range, start: action.start, end: action.end } : range) };
  if (action.type === 'commit-range-trim') {
    const range = state.ranges.find(({ id }) => id === action.id);
    const asset = range && state.assets.find(({ id }) => id === range.assetId);
    if (!range || !asset) return state;
    const minimum = asset.fps > 0 ? 1 / asset.fps : .01;
    const start = Math.min(Math.max(0, action.start), asset.duration - minimum);
    const end = Math.min(asset.duration, Math.max(start + minimum, action.end));
    return { ...state, ranges: state.ranges.map((item) => item.id === range.id ? {
      ...item,
      start: Math.round(start * 1000) / 1000,
      end: Math.round(end * 1000) / 1000
    } : item) };
  }
  if (action.type === 'reorder-range') {
    const moving = state.ranges.find(({ id }) => id === action.id);
    const target = state.ranges.find(({ id }) => id === action.beforeId);
    if (!moving || !target || moving.id === target.id || moving.assetId !== target.assetId) return state;
    const ranges = state.ranges.filter(({ id }) => id !== moving.id);
    const targetIndex = ranges.findIndex(({ id }) => id === target.id);
    ranges.splice(targetIndex, 0, moving);
    return { ...state, ranges };
  }
  if (action.type === 'insert-range') {
    const asset = state.assets.find(({ id }) => id === action.assetId);
    if (!asset || asset.kind === 'image') return state;
    return {
      ...state,
      selectedAssetId: asset.id,
      currentTime: 0,
      markIn: 0,
      markOut: asset.duration,
      ranges: [...state.ranges, { id: crypto.randomUUID(), assetId: asset.id, start: 0, end: asset.duration }]
    };
  }
  if (action.type === 'move-range') {
    const index = state.ranges.findIndex(({ id }) => id === action.id);
    const target = index + action.direction;
    if (index < 0 || target < 0 || target >= state.ranges.length || state.ranges[index].assetId !== state.ranges[target].assetId) return state;
    const ranges = [...state.ranges]; [ranges[index], ranges[target]] = [ranges[target], ranges[index]];
    return { ...state, ranges };
  }
  if (action.type === 'set-tab') return { ...state, tab: action.tab };
  if (action.type === 'set-crop') return { ...state, adjustments: { ...state.adjustments, crop: action.crop } };
  if (action.type === 'set-adjustments') return { ...state, adjustments: { ...state.adjustments, ...action.value, crop: action.value.crop ?? state.adjustments.crop } };
  if (action.type === 'set-output') return { ...state, output: { ...state.output, ...action.value } };
  if (action.type === 'set-merge-order') return { ...state, mergeOrder: action.value };
  if (action.type === 'set-merge-range') return { ...state, mergeRanges: { ...state.mergeRanges, [action.assetId]: { start: action.start, end: action.end } } };
  if (action.type === 'set-side-assets') return { ...state, sideLeftAssetId: action.left, sideRightAssetId: action.right };
  if (action.type === 'set-side-settings') return { ...state, sideBySide: { ...state.sideBySide, ...action.value } };
  if (action.type === 'set-frame') return { ...state, frame: { ...state.frame, ...action.value } };
  if (action.type === 'set-gif') return { ...state, gif: { ...state.gif, ...action.value } };
  return state;
}

const transient = new Set<EditorAction['type']>(['hydrate', 'select-asset', 'select-timeline-clip', 'set-current-time', 'set-markers', 'set-tab']);

export function editorReducer(history: EditorHistory, action: EditorAction): EditorHistory {
  if (action.type === 'undo') {
    const previous = history.past.at(-1); return previous ? { present: previous, past: history.past.slice(0, -1), future: [history.present, ...history.future] } : history;
  }
  if (action.type === 'redo') {
    const next = history.future[0]; return next ? { present: next, past: [...history.past, history.present].slice(-50), future: history.future.slice(1) } : history;
  }
  const present = reduce(history.present, action);
  if (present === history.present) return history;
  return transient.has(action.type) ? { ...history, present } : { present, past: [...history.past, history.present].slice(-50), future: [] };
}

export function serializeExport(state: EditorState): ExportRequest {
  const selected = selectedAsset(state);
  if (!selected) throw new Error('Selecione uma mídia.');
  let operation: ExportRequest['operation'] = 'cut';
  let inputs: ExportRequest['inputs'] = [];
  if (state.tab === 'timeline') {
    operation = 'timeline';
    inputs = resolveTimeline(state.tracks, state.assets).map(({ assetId, sourceStart, sourceEnd }) => ({
      assetId,
      start: sourceStart,
      end: sourceEnd
    }));
  } else if (state.tab === 'merge') {
    operation = 'merge'; inputs = state.mergeOrder.map((assetId) => ({ assetId, ...state.mergeRanges[assetId] }));
  } else if (state.tab === 'side-by-side') {
    operation = 'side-by-side'; inputs = [state.sideLeftAssetId, state.sideRightAssetId].map((assetId) => { const asset = state.assets.find(({ id }) => id === assetId)!; return { assetId, start: 0, end: asset.duration }; });
  } else if (state.tab === 'frame') {
    operation = 'frame'; inputs = [{ assetId: selected.id, start: 0, end: selected.duration }];
  } else if (state.tab === 'gif') {
    operation = 'gif'; inputs = [{ assetId: selected.id, start: state.gif.start, end: state.gif.end }];
  } else {
    const ranges = state.ranges.filter(({ assetId }) => assetId === selected.id);
    inputs = ranges.length ? ranges.map(({ assetId, start, end }) => ({ assetId, start, end })) : [{ assetId: selected.id, start: 0, end: selected.duration }];
  }
  return { projectId: state.projectId, operation, inputs, adjustments: state.adjustments, output: state.output, sideBySide: state.sideBySide, frame: { ...state.frame, time: state.currentTime }, gif: state.gif, transition: state.timelineTransition };
}
