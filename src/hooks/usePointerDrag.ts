import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

type PointerDragOptions<T extends HTMLElement> = {
  onStart: (event: ReactPointerEvent<T>) => void;
  onMove: (event: ReactPointerEvent<T>) => void;
  onCommit: (event: ReactPointerEvent<T>) => void;
};

export function usePointerDrag<T extends HTMLElement>({ onStart, onMove, onCommit }: PointerDragOptions<T>) {
  const activePointer = useRef<number | null>(null);
  return {
    onPointerDown(event: ReactPointerEvent<T>) {
      activePointer.current = event.pointerId;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      onStart(event);
    },
    onPointerMove(event: ReactPointerEvent<T>) {
      if (activePointer.current !== event.pointerId) return;
      onMove(event);
    },
    onPointerUp(event: ReactPointerEvent<T>) {
      if (activePointer.current !== event.pointerId) return;
      onCommit(event);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      activePointer.current = null;
    },
    onPointerCancel(event: ReactPointerEvent<T>) {
      if (activePointer.current === event.pointerId) activePointer.current = null;
    }
  };
}
