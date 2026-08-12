import { Crop, Minus, Plus, Scissors, Trash2 } from 'lucide-react';
import type { EditorAsset } from '../../shared/types';
import type { EditorRange, EditorState } from '../editor/editorState';

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}.${String(Math.floor(seconds * 100) % 100).padStart(2, '0')}`;
type Props = { state: EditorState; asset?: EditorAsset; onSeek: (time: number) => void; onAdd: () => void; onRemove: (id: string) => void };

export function Timeline({ state, asset, onSeek, onAdd, onRemove }: Props) {
  const duration = Math.max(asset?.duration ?? 1, 1);
  const scoped = state.ranges.filter((range) => range.assetId === asset?.id);
  const markers = [0, .2, .4, .6, .8, 1];
  return <section className="timeline" aria-label="Timeline">
    <div className="timeline-tools"><button aria-label="Cortar"><Scissors /></button><button aria-label="Excluir trecho" disabled={!scoped.length} onClick={() => scoped.at(-1) && onRemove(scoped.at(-1)!.id)}><Trash2 /></button><button aria-label="Crop"><Crop /></button><button aria-label="Adicionar trecho" onClick={onAdd}><Plus /></button><span /><button aria-label="Diminuir zoom"><Minus /></button><input aria-label="Zoom da timeline" type="range" min="1" max="4" defaultValue="1" /><button aria-label="Aumentar zoom"><Plus /></button></div>
    <div className="timeline-scroll">
      <div className="ruler">{markers.map((position) => <span style={{ left: `${position * 100}%` }} key={position}>{clock(duration * position)}</span>)}</div>
      {asset ? <button className="thumbnail-strip" type="button" onClick={(event) => { const box = event.currentTarget.getBoundingClientRect(); onSeek((event.clientX - box.left) / box.width * duration); }}>{Array.from({ length: 12 }, (_, index) => <img key={index} src={`/api/assets/${asset.id}/thumbnail`} alt="" />)}</button> : <div className="thumbnail-strip empty" />}
      <div className="range-track">{scoped.map((range, index) => <RangeBlock range={range} duration={duration} index={index} key={range.id} onRemove={onRemove} />)}</div>
      <div className="playhead" style={{ left: `${state.currentTime / duration * 100}%` }}><span>{clock(state.currentTime)}</span></div>
    </div>
  </section>;
}

function RangeBlock({ range, duration, index, onRemove }: { range: EditorRange; duration: number; index: number; onRemove: (id: string) => void }) {
  return <button type="button" className="range-block" style={{ left: `${range.start / duration * 100}%`, width: `${(range.end - range.start) / duration * 100}%` }} onDoubleClick={() => onRemove(range.id)}><i /><strong>Trecho {index + 1}</strong><span>{clock(range.start)} — {clock(range.end)}</span><i /></button>;
}
