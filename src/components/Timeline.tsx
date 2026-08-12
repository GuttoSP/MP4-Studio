import { useEffect, useState } from 'react';
import { Crop, Minus, Plus, Scissors, Trash2 } from 'lucide-react';
import type { EditorAsset, TimelineThumbnail } from '../../shared/types';
import { api } from '../api';
import type { EditorRange, EditorState } from '../editor/editorState';

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}.${String(Math.floor(seconds * 100) % 100).padStart(2, '0')}`;
const frameCache = new Map<string, TimelineThumbnail[]>();

type Props = {
  state: EditorState;
  asset?: EditorAsset;
  onSeek: (time: number) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
};

export function Timeline({ state, asset, onSeek, onAdd, onRemove }: Props) {
  const duration = Math.max(asset?.duration ?? 1, 1);
  const scoped = state.ranges.filter((range) => range.assetId === asset?.id);
  const markers = [0, .2, .4, .6, .8, 1];
  const [frames, setFrames] = useState<TimelineThumbnail[]>([]);
  const [filmstripStatus, setFilmstripStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

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

  const seekFromPointer = (clientX: number, element: HTMLElement) => {
    const box = element.getBoundingClientRect();
    const ratio = box.width ? Math.min(1, Math.max(0, (clientX - box.left) / box.width)) : 0;
    onSeek(ratio * duration);
  };

  return <section className="timeline" aria-label="Timeline">
    <div className="timeline-tools">
      <button aria-label="Cortar"><Scissors /></button>
      <button aria-label="Excluir trecho" disabled={!scoped.length} onClick={() => scoped.at(-1) && onRemove(scoped.at(-1)!.id)}><Trash2 /></button>
      <button aria-label="Crop"><Crop /></button>
      <button aria-label="Adicionar trecho" onClick={onAdd}><Plus /></button>
      <span />
      <button aria-label="Diminuir zoom"><Minus /></button>
      <input aria-label="Zoom da timeline" type="range" min="1" max="4" defaultValue="1" />
      <button aria-label="Aumentar zoom"><Plus /></button>
    </div>
    <div className="timeline-scroll">
      <div className="ruler">{markers.map((position) => <span style={{ left: `${position * 100}%` }} key={position}>{clock(duration * position)}</span>)}</div>
      {asset ? <button
        aria-label="Navegar pelos quadros do vídeo"
        className="thumbnail-strip"
        data-status={filmstripStatus}
        type="button"
        onClick={(event) => seekFromPointer(event.clientX, event.currentTarget)}
      >
        {frames.map((frame) => <span className="timeline-frame-slot" key={frame.frameIndex}>
          <span
            className="timeline-frame"
            data-testid={`timeline-frame-${frame.frameIndex}`}
            style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
          >
            <img
              className="timeline-frame-image"
              src={frame.url}
              alt={`Quadro em ${clock(frame.time)}`}
              draggable={false}
            />
            <small>{clock(frame.time)}</small>
          </span>
        </span>)}
        {filmstripStatus === 'loading' && <span className="timeline-filmstrip-message">Gerando quadros…</span>}
        {filmstripStatus === 'error' && <span className="timeline-filmstrip-message">Não foi possível carregar os quadros.</span>}
      </button> : <div className="thumbnail-strip empty" />}
      <div className="range-track">{scoped.map((range, index) => <RangeBlock range={range} duration={duration} index={index} key={range.id} onRemove={onRemove} />)}</div>
      <div className="playhead" style={{ left: `${state.currentTime / duration * 100}%` }}><span>{clock(state.currentTime)}</span></div>
    </div>
  </section>;
}

function RangeBlock({ range, duration, index, onRemove }: { range: EditorRange; duration: number; index: number; onRemove: (id: string) => void }) {
  return <button type="button" className="range-block" style={{ left: `${range.start / duration * 100}%`, width: `${(range.end - range.start) / duration * 100}%` }} onDoubleClick={() => onRemove(range.id)}><i /><strong>Trecho {index + 1}</strong><span>{clock(range.start)} — {clock(range.end)}</span><i /></button>;
}
