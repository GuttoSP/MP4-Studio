import { useEffect, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Crop, Minus, Plus, Scissors, Trash2 } from 'lucide-react';
import type { EditorAsset, TimelineThumbnail } from '../../shared/types';
import { api } from '../api';
import { timeFromPointer, snapTime } from './timeline/timelineMath';
import { usePointerDrag } from '../hooks/usePointerDrag';
import { TimelineClip } from './timeline/TimelineClip';
import { ASSET_DRAG_MIME } from './MediaLibrary';
import type { EditorState } from '../editor/editorState';

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}.${String(Math.floor(seconds * 100) % 100).padStart(2, '0')}`;
const frameCache = new Map<string, TimelineThumbnail[]>();

type Props = {
  state: EditorState;
  asset?: EditorAsset;
  onSeek: (time: number) => void;
  onZoom?: (zoom: number) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate?: (id: string, start: number, end: number) => void;
  onReorder?: (id: string, beforeId: string) => void;
  onAssetDrop?: (assetId: string) => void;
};

export function Timeline({ state, asset, onSeek, onZoom, onAdd, onRemove, onUpdate, onReorder, onAssetDrop }: Props) {
  const duration = Math.max(asset?.duration ?? 1, 1);
  const scoped = state.ranges.filter((range) => range.assetId === asset?.id);
  const markers = [0, .2, .4, .6, .8, 1];
  const [frames, setFrames] = useState<TimelineThumbnail[]>([]);
  const [filmstripStatus, setFilmstripStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [draftTime, setDraftTime] = useState<number | null>(null);
  const displayedTime = draftTime ?? state.currentTime;

  useEffect(() => {
    let active = true;
    if (!asset) {
      setFrames([]);
      setFilmstripStatus('idle');
      return () => { active = false; };
    }
    const cached = frameCache.get(asset.id);
    if (cached) {
      setFrames(cached);
      setFilmstripStatus('ready');
      return () => { active = false; };
    }
    setFrames([]);
    setFilmstripStatus('loading');
    void api.listTimelineThumbnails(asset.id).then(({ frames: loaded }) => {
      if (!active) return;
      frameCache.set(asset.id, loaded);
      setFrames(loaded);
      setFilmstripStatus('ready');
    }).catch(() => {
      if (active) setFilmstripStatus('error');
    });
    return () => { active = false; };
  }, [asset]);

  const pointerTime = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return snapTime(timeFromPointer(event.clientX, box.left, box.width, duration), asset?.fps ?? 0, duration);
  };
  const scrub = usePointerDrag<HTMLDivElement>({
    onStart: (event) => setDraftTime(pointerTime(event)),
    onMove: (event) => setDraftTime(pointerTime(event)),
    onCommit: (event) => {
      const time = pointerTime(event);
      setDraftTime(null);
      onSeek(time);
    }
  });
  const setZoom = (zoom: number) => onZoom?.(Math.min(4, Math.max(1, Number(zoom.toFixed(2)))));

  return <section className="timeline" aria-label="Timeline">
    <div className="timeline-tools">
      <button aria-label="Cortar"><Scissors /></button>
      <button aria-label="Excluir trecho" disabled={!scoped.length} onClick={() => scoped.at(-1) && onRemove(scoped.at(-1)!.id)}><Trash2 /></button>
      <button aria-label="Crop"><Crop /></button>
      <button aria-label="Adicionar trecho" onClick={onAdd}><Plus /></button>
      <span />
      <button aria-label="Diminuir zoom" onClick={() => setZoom(state.timelineZoom - .25)}><Minus /></button>
      <input aria-label="Zoom da timeline" type="range" min="1" max="4" step=".25" value={state.timelineZoom} onChange={(event) => setZoom(Number(event.target.value))} />
      <button aria-label="Aumentar zoom" onClick={() => setZoom(state.timelineZoom + .25)}><Plus /></button>
    </div>
    <div className="timeline-scroll">
      <div
        className="timeline-canvas"
        data-testid="timeline-canvas"
        style={{ width: `${state.timelineZoom * 100}%` }}
        onDragOver={(event) => { if (event.dataTransfer.types.includes(ASSET_DRAG_MIME)) event.preventDefault(); }}
        onDrop={(event) => {
          event.preventDefault();
          const assetId = event.dataTransfer.getData(ASSET_DRAG_MIME);
          if (assetId) onAssetDrop?.(assetId);
        }}
        {...scrub}
      >
        <div className="ruler">{markers.map((position) => <span style={{ left: `${position * 100}%` }} key={position}>{clock(duration * position)}</span>)}</div>
        {asset ? <div aria-label="Navegar pelos quadros do vídeo" className="thumbnail-strip" data-status={filmstripStatus} role="button" tabIndex={0}>
          {frames.map((frame) => <span className="timeline-frame-slot" data-testid={`timeline-frame-${frame.frameIndex}`} key={frame.frameIndex}>
            <img
              className="timeline-frame-image"
              src={frame.url}
              alt={`Quadro em ${clock(frame.time)}`}
              draggable={false}
              style={{
                aspectRatio: `${frame.width} / ${frame.height}`,
                width: frame.width >= frame.height ? '100%' : 'auto',
                height: frame.width >= frame.height ? 'auto' : '100%'
              }}
            />
            <small>{clock(frame.time)}</small>
          </span>)}
          {filmstripStatus === 'loading' && <span className="timeline-filmstrip-message">Gerando quadros…</span>}
          {filmstripStatus === 'error' && <span className="timeline-filmstrip-message">Não foi possível carregar os quadros.</span>}
        </div> : <div className="thumbnail-strip empty" />}
        <div className="range-track">{scoped.map((range, index) => <TimelineClip
          range={range}
          duration={duration}
          fps={asset?.fps ?? 0}
          index={index}
          key={range.id}
          onRemove={onRemove}
          onTrim={(id, start, end) => onUpdate?.(id, start, end)}
          onReorder={(id, beforeId) => onReorder?.(id, beforeId)}
        />)}</div>
        <div className="playhead" role="slider" aria-label="Posição do playhead" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={displayedTime} style={{ left: `${displayedTime / duration * 100}%` }}><span>{clock(displayedTime)}</span></div>
      </div>
    </div>
  </section>;
}
