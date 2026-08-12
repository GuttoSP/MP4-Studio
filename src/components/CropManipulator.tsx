import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CropRect } from '../../shared/editorTypes';

type Mode = 'move' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
type Props = { crop: CropRect; onCommit: (crop: CropRect) => void };
const handles: Exclude<Mode, 'move'>[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const names: Record<Exclude<Mode, 'move'>, string> = {
  nw: 'Canto superior esquerdo', n: 'Borda superior', ne: 'Canto superior direito',
  e: 'Borda direita', se: 'Canto inferior direito', s: 'Borda inferior',
  sw: 'Canto inferior esquerdo', w: 'Borda esquerda'
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const rounded = (value: number) => Number(value.toFixed(4));

export function CropManipulator({ crop, onCommit }: Props) {
  const overlay = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(crop);
  const active = useRef<{ pointerId: number; mode: Mode; x: number; y: number; initial: CropRect } | null>(null);
  useEffect(() => setDraft(crop), [crop]);

  const valueAt = (clientX: number, clientY: number): CropRect => {
    const gesture = active.current;
    const box = overlay.current?.getBoundingClientRect();
    if (!gesture || !box?.width || !box.height) return draft;
    const dx = (clientX - gesture.x) / box.width;
    const dy = (clientY - gesture.y) / box.height;
    const initial = gesture.initial;
    if (gesture.mode === 'move') return {
      ...initial,
      x: rounded(clamp(initial.x + dx, 0, 1 - initial.width)),
      y: rounded(clamp(initial.y + dy, 0, 1 - initial.height))
    };
    const minimum = .05;
    let left = initial.x;
    let right = initial.x + initial.width;
    let top = initial.y;
    let bottom = initial.y + initial.height;
    if (gesture.mode.includes('w')) left = clamp(left + dx, 0, right - minimum);
    if (gesture.mode.includes('e')) right = clamp(right + dx, left + minimum, 1);
    if (gesture.mode.includes('n')) top = clamp(top + dy, 0, bottom - minimum);
    if (gesture.mode.includes('s')) bottom = clamp(bottom + dy, top + minimum, 1);
    return { x: rounded(left), y: rounded(top), width: rounded(right - left), height: rounded(bottom - top) };
  };
  const start = (mode: Mode) => (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    active.current = { pointerId: event.pointerId, mode, x: event.clientX, y: event.clientY, initial: draft };
  };
  const move = (event: ReactPointerEvent<HTMLElement>) => {
    if (active.current?.pointerId === event.pointerId) setDraft(valueAt(event.clientX, event.clientY));
  };
  const finish = (event: ReactPointerEvent<HTMLElement>) => {
    if (active.current?.pointerId !== event.pointerId) return;
    const value = valueAt(event.clientX, event.clientY);
    setDraft(value);
    active.current = null;
    onCommit(value);
  };

  return <div className="crop-manipulator" data-testid="crop-overlay" ref={overlay}>
    <div
      className="crop-selection"
      style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.width * 100}%`, height: `${draft.height * 100}%` }}
    >
      <div className="crop-move" role="button" tabIndex={0} aria-label="Mover área de crop" onPointerDown={start('move')} onPointerMove={move} onPointerUp={finish} />
      {handles.map((mode) => <span
        className={`crop-handle ${mode}`}
        role="slider"
        tabIndex={0}
        aria-label={names[mode]}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={mode.includes('w') ? draft.x : mode.includes('e') ? draft.x + draft.width : mode.includes('n') ? draft.y : draft.y + draft.height}
        key={mode}
        onPointerDown={start(mode)}
        onPointerMove={move}
        onPointerUp={finish}
      />)}
    </div>
  </div>;
}
