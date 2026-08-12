import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { EditorRange } from '../../editor/editorState';
import { usePointerDrag } from '../../hooks/usePointerDrag';
import { snapTime, timeFromPointer } from './timelineMath';

const RANGE_MIME = 'application/x-mp4-studio-range';
const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}.${String(Math.floor(seconds * 100) % 100).padStart(2, '0')}`;

type Props = {
  range: EditorRange;
  duration: number;
  fps: number;
  index: number;
  onTrim: (id: string, start: number, end: number) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, beforeId: string) => void;
};

export function TimelineClip({ range, duration, fps, index, onTrim, onRemove, onReorder }: Props) {
  const [draft, setDraft] = useState(range);
  const draftRef = useRef(range);
  const minimum = fps > 0 ? 1 / fps : .01;
  const update = (value: EditorRange) => { draftRef.current = value; setDraft(value); };
  useEffect(() => { update(range); }, [range]);
  const pointerTime = (event: ReactPointerEvent<HTMLElement>) => {
    const track = event.currentTarget.closest('.range-track') as HTMLElement | null;
    const box = track?.getBoundingClientRect();
    return box ? snapTime(timeFromPointer(event.clientX, box.left, box.width, duration), fps, duration) : 0;
  };
  const leftValue = (event: ReactPointerEvent<HTMLElement>) => ({
    ...draftRef.current,
    start: Math.min(pointerTime(event), draftRef.current.end - minimum)
  });
  const rightValue = (event: ReactPointerEvent<HTMLElement>) => ({
    ...draftRef.current,
    end: Math.max(pointerTime(event), draftRef.current.start + minimum)
  });
  const leftDrag = usePointerDrag<HTMLElement>({
    onStart: (event) => { event.stopPropagation(); update(leftValue(event)); },
    onMove: (event) => update(leftValue(event)),
    onCommit: (event) => { const value = leftValue(event); update(value); onTrim(range.id, value.start, value.end); }
  });
  const rightDrag = usePointerDrag<HTMLElement>({
    onStart: (event) => { event.stopPropagation(); update(rightValue(event)); },
    onMove: (event) => update(rightValue(event)),
    onCommit: (event) => { const value = rightValue(event); update(value); onTrim(range.id, value.start, value.end); }
  });
  const keyTrim = (side: 'start' | 'end', direction: -1 | 1) => {
    const step = fps > 0 ? 1 / fps : .01;
    const value = side === 'start'
      ? { ...draft, start: Math.max(0, Math.min(draft.start + direction * step, draft.end - minimum)) }
      : { ...draft, end: Math.min(duration, Math.max(draft.end + direction * step, draft.start + minimum)) };
    update(value);
    onTrim(range.id, value.start, value.end);
  };

  return <div
    className="range-block"
    draggable
    onPointerDown={(event) => event.stopPropagation()}
    onDoubleClick={() => onRemove(range.id)}
    onDragStart={(event) => event.dataTransfer.setData(RANGE_MIME, range.id)}
    onDragOver={(event) => event.preventDefault()}
    onDrop={(event) => {
      event.preventDefault();
      event.stopPropagation();
      const movingId = event.dataTransfer.getData(RANGE_MIME);
      if (movingId) onReorder(movingId, range.id);
    }}
    style={{ left: `${draft.start / duration * 100}%`, width: `${(draft.end - draft.start) / duration * 100}%` }}
  >
    <span
      className="trim-handle start"
      role="slider"
      tabIndex={0}
      aria-label={`Início do Trecho ${index + 1}`}
      aria-valuemin={0}
      aria-valuemax={draft.end - minimum}
      aria-valuenow={draft.start}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') keyTrim('start', event.key === 'ArrowLeft' ? -1 : 1);
      }}
      {...leftDrag}
    />
    <strong>Trecho {index + 1}</strong>
    <span>{clock(draft.start)} — {clock(draft.end)}</span>
    <span
      className="trim-handle end"
      role="slider"
      tabIndex={0}
      aria-label={`Fim do Trecho ${index + 1}`}
      aria-valuemin={draft.start + minimum}
      aria-valuemax={duration}
      aria-valuenow={draft.end}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') keyTrim('end', event.key === 'ArrowLeft' ? -1 : 1);
      }}
      {...rightDrag}
    />
  </div>;
}
