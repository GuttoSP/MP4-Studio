import { Camera, Maximize, Pause, Play, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { EditorAsset } from '../../shared/types';
import type { EditorState } from '../editor/editorState';
import { ASSET_DRAG_MIME } from './MediaLibrary';
import { CropManipulator } from './CropManipulator';

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}.${String(Math.floor(seconds * 100) % 100).padStart(2, '0')}`;

type Props = { state: EditorState; selected?: EditorAsset; left?: EditorAsset; right?: EditorAsset; onTime: (time: number) => void; onSideDrop?: (side: 'left' | 'right', assetId: string) => void; onCropCommit?: (crop: EditorState['adjustments']['crop']) => void; onDividerCommit?: (divider: number) => void };

export function PreviewMonitor({ state, selected, left, right, onTime, onSideDrop, onCropCommit, onDividerCommit }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const dividerPointer = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [dividerDraft, setDividerDraft] = useState(state.sideBySide.divider);
  useEffect(() => { if (video.current && Math.abs(video.current.currentTime - state.currentTime) > 0.3) video.current.currentTime = state.currentTime; }, [state.currentTime]);
  useEffect(() => setDividerDraft(state.sideBySide.divider), [state.sideBySide.divider]);
  const dividerAt = (clientX: number) => {
    const box = stage.current?.getBoundingClientRect();
    if (!box?.width) return dividerDraft;
    return Number(Math.min(.8, Math.max(.2, (clientX - box.left) / box.width)).toFixed(2));
  };
  const transform = `rotate(${state.adjustments.rotation}deg) scale(${state.adjustments.flipHorizontal ? -1 : 1},${state.adjustments.flipVertical ? -1 : 1})`;
  const media = (asset: EditorAsset) => asset.kind === 'image'
    ? <img src={`/api/assets/${asset.id}/content`} alt={asset.name} />
    : <video muted src={`/api/assets/${asset.id}/content`} poster={`/api/assets/${asset.id}/thumbnail`} preload="metadata" />;
  return <section className="monitor" aria-label="Monitor de vídeo">
    <div className="monitor-stage" ref={stage}>
      {state.tab === 'side-by-side' && left && right ? <div className="side-preview" style={{ gridTemplateColumns: `${dividerDraft * 100}% 1fr` }}>{media(left)}{media(right)}</div> : selected ? (
        selected.kind === 'image' ? <img className="main-media" src={`/api/assets/${selected.id}/content`} alt={selected.name} style={{ transform, width: '100%', height: '100%', minWidth: 0, minHeight: 0, objectFit: 'contain' }} /> :
          <video className="main-media" ref={video} src={`/api/assets/${selected.id}/content`} poster={`/api/assets/${selected.id}/thumbnail`} preload="metadata" style={{ transform, width: '100%', height: '100%', minWidth: 0, minHeight: 0, objectFit: 'contain' }} onTimeUpdate={(event) => onTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
      ) : <div className="monitor-empty"><FilmFallback /><span>Importe um vídeo para começar</span></div>}
      {state.tab === 'crop' && selected && <CropManipulator crop={state.adjustments.crop} onCommit={(crop) => onCropCommit?.(crop)} />}
      {state.tab === 'side-by-side' && <div className="side-drop-zones">
        {(['left', 'right'] as const).map((side) => <button
          type="button"
          key={side}
          aria-label={`Soltar mídia no lado ${side === 'left' ? 'esquerdo' : 'direito'}`}
          onDragOver={(event) => { if (event.dataTransfer.types.includes(ASSET_DRAG_MIME)) event.preventDefault(); }}
          onDrop={(event) => {
            event.preventDefault();
            const assetId = event.dataTransfer.getData(ASSET_DRAG_MIME);
            if (assetId) onSideDrop?.(side, assetId);
          }}
        ><span>{side === 'left' ? 'Esquerda' : 'Direita'}</span><small>Solte a mídia aqui</small></button>)}
      </div>}
      {state.tab === 'side-by-side' && <div
        className="side-divider"
        role="slider"
        tabIndex={0}
        aria-label="Divisor lado a lado"
        aria-valuemin={.2}
        aria-valuemax={.8}
        aria-valuenow={dividerDraft}
        style={{ left: `${dividerDraft * 100}%` }}
        onPointerDown={(event) => { dividerPointer.current = event.pointerId; event.currentTarget.setPointerCapture?.(event.pointerId); setDividerDraft(dividerAt(event.clientX)); }}
        onPointerMove={(event) => { if (dividerPointer.current === event.pointerId) setDividerDraft(dividerAt(event.clientX)); }}
        onPointerUp={(event) => { if (dividerPointer.current !== event.pointerId) return; const divider = dividerAt(event.clientX); dividerPointer.current = null; setDividerDraft(divider); onDividerCommit?.(divider); }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          const divider = Number(Math.min(.8, Math.max(.2, dividerDraft + (event.key === 'ArrowLeft' ? -.01 : .01))).toFixed(2));
          setDividerDraft(divider); onDividerCommit?.(divider);
        }}
      ><span /></div>}
    </div>
    <div className="transport"><strong>{clock(state.currentTime)}</strong><span>/ {clock(selected?.duration ?? 0)}</span><div><button aria-label="Início" onClick={() => { onTime(0); if (video.current) video.current.currentTime = 0; }}><SkipBack /></button><button className="play" aria-label={playing ? 'Pausar' : 'Reproduzir'} onClick={() => video.current && (video.current.paused ? void video.current.play() : video.current.pause())}>{playing ? <Pause /> : <Play />}</button><button aria-label="Fim" onClick={() => { const duration = selected?.duration ?? 0; onTime(duration); if (video.current) video.current.currentTime = duration; }}><SkipForward /></button></div><div className="transport-end"><Camera /><Volume2 /><Maximize /></div></div>
  </section>;
}

function FilmFallback() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM8 4v16M16 4v16M4 9h4M16 9h4M4 15h4M16 15h4" /></svg>; }
