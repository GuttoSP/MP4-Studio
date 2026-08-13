import { useEffect, useRef, useState } from 'react';
import type { DragEvent, PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Layers3, Minus, Plus, Scissors, Trash2 } from 'lucide-react';
import type { TimelineLayerClip, TimelineTrack } from '../../shared/editorTypes';
import type { EditorAsset, TimelineThumbnail } from '../../shared/types';
import { timelineDuration } from '../../shared/timelineComposition';
import type { EditorAction, EditorState } from '../editor/editorState';
import { usePointerDrag } from '../hooks/usePointerDrag';
import { api } from '../api';
import { ASSET_DRAG_MIME } from './MediaLibrary';
import { snapTime, timeFromPointer } from './timeline/timelineMath';

export const TIMELINE_CLIP_MIME = 'application/x-mp4-studio-timeline-clip';
const timelineFrameCache = new Map<string, TimelineThumbnail[]>();

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}.${String(Math.floor(seconds * 100) % 100).padStart(2, '0')}`;

type Props = { state: EditorState; dispatch: (action: EditorAction) => void };

function dropTime(event: DragEvent<HTMLElement>, duration: number, fps: number) {
  const box = event.currentTarget.getBoundingClientRect();
  return snapTime(timeFromPointer(event.clientX, box.left, box.width, duration), fps, duration);
}

export function LayeredTimeline({ state, dispatch }: Props) {
  const duration = Math.max(1, timelineDuration(state.tracks));
  const selectedClip = state.tracks.flatMap(({ clips }) => clips).find(({ id }) => id === state.selectedClipId);
  const markers = [0, .2, .4, .6, .8, 1];
  const [framesByAsset, setFramesByAsset] = useState<Record<string, TimelineThumbnail[]>>({});
  const videoAssetIds = state.assets.filter(({ kind }) => kind !== 'image').map(({ id }) => id);
  const videoAssetKey = videoAssetIds.join('|');
  const zoom = (value: number) => dispatch({ type: 'set-timeline-zoom', zoom: Math.min(4, Math.max(1, Number(value.toFixed(2)))) });

  useEffect(() => {
    let active = true;
    void Promise.all(videoAssetIds.map(async (assetId) => {
      const cached = timelineFrameCache.get(assetId);
      if (cached) return [assetId, cached] as const;
      try {
        const { frames } = await api.listTimelineThumbnails(assetId);
        timelineFrameCache.set(assetId, frames);
        return [assetId, frames] as const;
      } catch {
        return [assetId, []] as const;
      }
    })).then((entries) => { if (active) setFramesByAsset(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [videoAssetKey]);

  return <section className="timeline layered-timeline" aria-label="Timeline multicamadas">
    <div className="timeline-tools layered-tools">
      <button type="button" aria-label="Dividir clipe no playhead" disabled={!selectedClip} onClick={() => selectedClip && dispatch({ type: 'split-timeline-clip', clipId: selectedClip.id, time: state.currentTime })}><Scissors /></button>
      <button type="button" aria-label="Ocultar intervalo marcado" disabled={!state.selectedTrackId || state.markOut <= state.markIn} onClick={() => dispatch({ type: 'hide-timeline-interval', trackId: state.selectedTrackId, start: state.markIn, end: state.markOut })}><EyeOff /></button>
      <button type="button" aria-label={selectedClip?.enabled ? 'Ocultar clipe selecionado' : 'Exibir clipe selecionado'} disabled={!selectedClip} onClick={() => selectedClip && dispatch({ type: 'set-timeline-clip-enabled', clipId: selectedClip.id, enabled: !selectedClip.enabled })}>{selectedClip?.enabled ? <EyeOff /> : <Eye />}</button>
      <button type="button" aria-label="Excluir clipe selecionado" disabled={!selectedClip} onClick={() => selectedClip && dispatch({ type: 'remove-timeline-clip', clipId: selectedClip.id })}><Trash2 /></button>
      <button type="button" className="add-track-button" onClick={() => dispatch({ type: 'add-timeline-track' })}><Layers3 /> Adicionar faixa</button>
      <button type="button" aria-label="Diminuir zoom" onClick={() => zoom(state.timelineZoom - .25)}><Minus /></button>
      <input aria-label="Zoom da timeline" type="range" min="1" max="4" step=".25" value={state.timelineZoom} onChange={(event) => zoom(Number(event.target.value))} />
      <button type="button" aria-label="Aumentar zoom" onClick={() => zoom(state.timelineZoom + .25)}><Plus /></button>
    </div>
    <div className="layered-scroll">
      <div className="layered-canvas" style={{ width: `${state.timelineZoom * 100}%` }}>
        <div className="layered-ruler-spacer" />
        <div className="ruler layered-ruler">{markers.map((position) => <span style={{ left: `${position * 100}%` }} key={position}>{clock(duration * position)}</span>)}</div>
        {state.tracks.map((track, index) => <TrackRow
          key={track.id}
          track={track}
          index={index}
          trackCount={state.tracks.length}
          duration={duration}
          state={state}
          framesByAsset={framesByAsset}
          dispatch={dispatch}
        />)}
        <div className="layered-playhead" style={{ left: `calc(156px + (100% - 156px) * ${Math.min(duration, state.currentTime) / duration})` }}><span>{clock(state.currentTime)}</span></div>
      </div>
    </div>
  </section>;
}

function TrackRow({ track, index, trackCount, duration, state, framesByAsset, dispatch }: {
  track: TimelineTrack;
  index: number;
  trackCount: number;
  duration: number;
  state: EditorState;
  framesByAsset: Record<string, TimelineThumbnail[]>;
  dispatch: (action: EditorAction) => void;
}) {
  const assetsById = new Map(state.assets.map((asset) => [asset.id, asset]));
  return <div className={`layered-track ${state.selectedTrackId === track.id ? 'selected' : ''}`}>
    <div className="layered-track-heading">
      <span>Prioridade {index + 1}</span>
      <strong title={track.name}>{track.name}</strong>
      <div>
        <button type="button" aria-label={`Aumentar prioridade de ${track.name}`} disabled={index === 0} onClick={() => dispatch({ type: 'reorder-timeline-track', trackId: track.id, direction: -1 })}><ArrowUp /></button>
        <button type="button" aria-label={`Diminuir prioridade de ${track.name}`} disabled={index === trackCount - 1} onClick={() => dispatch({ type: 'reorder-timeline-track', trackId: track.id, direction: 1 })}><ArrowDown /></button>
      </div>
    </div>
    <div
      className="layered-track-lane"
      data-testid={`timeline-track-${track.id}`}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        dispatch({ type: 'set-current-time', time: snapTime(timeFromPointer(event.clientX, box.left, box.width, duration), 0, duration) });
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(ASSET_DRAG_MIME) || event.dataTransfer.types.includes(TIMELINE_CLIP_MIME)) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const clipId = event.dataTransfer.getData(TIMELINE_CLIP_MIME);
        if (clipId) {
          const clip = state.tracks.flatMap(({ clips }) => clips).find(({ id }) => id === clipId);
          const asset = clip && assetsById.get(clip.assetId);
          dispatch({ type: 'move-timeline-clip', clipId, trackId: track.id, timelineStart: dropTime(event, duration, asset?.fps ?? 0) });
          return;
        }
        const assetId = event.dataTransfer.getData(ASSET_DRAG_MIME);
        const asset = assetsById.get(assetId);
        if (asset?.kind === 'video') dispatch({ type: 'place-timeline-clip', trackId: track.id, assetId, timelineStart: dropTime(event, duration, asset.fps) });
      }}
    >
      {track.clips.map((clip) => <LayerClip key={clip.id} clip={clip} track={track} duration={duration} asset={assetsById.get(clip.assetId)} frames={framesByAsset[clip.assetId] ?? []} state={state} dispatch={dispatch} />)}
      {!track.clips.length && <span className="track-drop-hint">Arraste um vídeo para esta faixa</span>}
    </div>
  </div>;
}

function LayerClip({ clip, track, duration, asset, frames, state, dispatch }: {
  clip: TimelineLayerClip;
  track: TimelineTrack;
  duration: number;
  asset?: EditorAsset;
  frames: TimelineThumbnail[];
  state: EditorState;
  dispatch: (action: EditorAction) => void;
}) {
  const end = clip.timelineStart + clip.sourceEnd - clip.sourceStart;
  const [draft, setDraft] = useState({ start: clip.timelineStart, end });
  const draftRef = useRef(draft);
  const update = (value: typeof draft) => { draftRef.current = value; setDraft(value); };
  useEffect(() => { update({ start: clip.timelineStart, end }); }, [clip.timelineStart, clip.sourceStart, clip.sourceEnd, end]);
  const minimum = asset?.fps ? 1 / asset.fps : .01;
  const pointerTime = (event: ReactPointerEvent<HTMLElement>) => {
    const lane = event.currentTarget.closest('.layered-track-lane') as HTMLElement | null;
    const box = lane?.getBoundingClientRect();
    return box ? snapTime(timeFromPointer(event.clientX, box.left, box.width, duration), asset?.fps ?? 0, duration) : 0;
  };
  const startValue = (event: ReactPointerEvent<HTMLElement>) => Math.max(0, Math.min(pointerTime(event), draftRef.current.end - minimum));
  const endValue = (event: ReactPointerEvent<HTMLElement>) => Math.min(duration, Math.max(pointerTime(event), draftRef.current.start + minimum));
  const startDrag = usePointerDrag<HTMLElement>({
    onStart: (event) => { event.stopPropagation(); update({ ...draftRef.current, start: startValue(event) }); },
    onMove: (event) => update({ ...draftRef.current, start: startValue(event) }),
    onCommit: (event) => { const time = startValue(event); update({ ...draftRef.current, start: time }); dispatch({ type: 'trim-timeline-clip', clipId: clip.id, edge: 'start', time }); }
  });
  const endDrag = usePointerDrag<HTMLElement>({
    onStart: (event) => { event.stopPropagation(); update({ ...draftRef.current, end: endValue(event) }); },
    onMove: (event) => update({ ...draftRef.current, end: endValue(event) }),
    onCommit: (event) => { const time = endValue(event); update({ ...draftRef.current, end: time }); dispatch({ type: 'trim-timeline-clip', clipId: clip.id, edge: 'end', time }); }
  });
  const selected = state.selectedClipId === clip.id;
  const clipFrames = [...new Map(frames
    .filter(({ time }) => time >= clip.sourceStart && time < clip.sourceEnd)
    .sort((left, right) => left.time - right.time)
    .map((frame) => [frame.time, frame])).values()];

  return <div
    role="button"
    tabIndex={0}
    draggable
    aria-label={`${asset?.name ?? 'Clipe'}, ${clip.enabled ? 'visível' : 'oculto'}, ${clock(draft.start)} até ${clock(draft.end)}`}
    className={`layered-clip ${selected ? 'selected' : ''} ${clip.enabled ? '' : 'disabled'}`}
    style={{ left: `${draft.start / duration * 100}%`, width: `${(draft.end - draft.start) / duration * 100}%` }}
    onClick={(event) => { event.stopPropagation(); dispatch({ type: 'select-timeline-clip', trackId: track.id, clipId: clip.id }); }}
    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') dispatch({ type: 'select-timeline-clip', trackId: track.id, clipId: clip.id }); }}
    onDragStart={(event) => { event.dataTransfer.setData(TIMELINE_CLIP_MIME, clip.id); event.dataTransfer.effectAllowed = 'move'; }}
  >
    <span className="layer-trim-handle start" role="slider" tabIndex={0} aria-label={`Início de ${asset?.name ?? 'clipe'}`} {...startDrag} />
    <span className="layered-clip-filmstrip" aria-hidden={clipFrames.length === 0}>
      {clipFrames.map((frame) => <img
        key={frame.frameIndex}
        src={frame.url}
        alt={`Quadro de ${asset?.name ?? 'clipe'} em ${clock(frame.time)}`}
        draggable={false}
        style={{ aspectRatio: `${frame.width} / ${frame.height}`, objectFit: 'contain' }}
      />)}
    </span>
    <span className="layered-clip-copy"><strong>{asset?.name ?? 'Mídia indisponível'}</strong><small>{clock(clip.sourceStart)} — {clock(clip.sourceEnd)}</small></span>
    <span className="clip-visibility" title={clip.enabled ? 'Visível' : 'Oculto'}>{clip.enabled ? <Eye /> : <EyeOff />}</span>
    <span className="layer-trim-handle end" role="slider" tabIndex={0} aria-label={`Fim de ${asset?.name ?? 'clipe'}`} {...endDrag} />
  </div>;
}
