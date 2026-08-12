import { Camera, Maximize, Pause, Play, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { EditorAsset } from '../../shared/types';
import type { EditorState } from '../editor/editorState';

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}.${String(Math.floor(seconds * 100) % 100).padStart(2, '0')}`;

type Props = { state: EditorState; selected?: EditorAsset; left?: EditorAsset; right?: EditorAsset; onTime: (time: number) => void };

export function PreviewMonitor({ state, selected, left, right, onTime }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { if (video.current && Math.abs(video.current.currentTime - state.currentTime) > 0.3) video.current.currentTime = state.currentTime; }, [state.currentTime]);
  const transform = `rotate(${state.adjustments.rotation}deg) scale(${state.adjustments.flipHorizontal ? -1 : 1},${state.adjustments.flipVertical ? -1 : 1})`;
  const media = (asset: EditorAsset) => asset.kind === 'image'
    ? <img src={`/api/assets/${asset.id}/content`} alt={asset.name} />
    : <video muted src={`/api/assets/${asset.id}/content`} poster={`/api/assets/${asset.id}/thumbnail`} preload="metadata" />;
  return <section className="monitor" aria-label="Monitor de vídeo">
    <div className="monitor-stage">
      {state.tab === 'side-by-side' && left && right ? <div className="side-preview" style={{ gridTemplateColumns: `${state.sideBySide.divider * 100}% 1fr` }}>{media(left)}{media(right)}</div> : selected ? (
        selected.kind === 'image' ? <img className="main-media" src={`/api/assets/${selected.id}/content`} alt={selected.name} style={{ transform }} /> :
          <video className="main-media" ref={video} src={`/api/assets/${selected.id}/content`} poster={`/api/assets/${selected.id}/thumbnail`} preload="metadata" style={{ transform }} onTimeUpdate={(event) => onTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
      ) : <div className="monitor-empty"><FilmFallback /><span>Importe um vídeo para começar</span></div>}
      {state.tab === 'crop' && selected && <div className="crop-preview-overlay" aria-hidden="true"><i style={{ left: `${state.adjustments.crop.x * 100}%`, top: `${state.adjustments.crop.y * 100}%`, width: `${state.adjustments.crop.width * 100}%`, height: `${state.adjustments.crop.height * 100}%` }} /></div>}
    </div>
    <div className="transport"><strong>{clock(state.currentTime)}</strong><span>/ {clock(selected?.duration ?? 0)}</span><div><button aria-label="Início" onClick={() => { onTime(0); if (video.current) video.current.currentTime = 0; }}><SkipBack /></button><button className="play" aria-label={playing ? 'Pausar' : 'Reproduzir'} onClick={() => video.current && (video.current.paused ? void video.current.play() : video.current.pause())}>{playing ? <Pause /> : <Play />}</button><button aria-label="Fim" onClick={() => { const duration = selected?.duration ?? 0; onTime(duration); if (video.current) video.current.currentTime = duration; }}><SkipForward /></button></div><div className="transport-end"><Camera /><Volume2 /><Maximize /></div></div>
  </section>;
}

function FilmFallback() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM8 4v16M16 4v16M4 9h4M16 9h4M4 15h4M16 15h4" /></svg>; }
