import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorAsset } from '../shared/types';
import { MediaLibrary } from '../src/components/MediaLibrary';
import { PreviewMonitor } from '../src/components/PreviewMonitor';
import { createInitialEditorHistory } from '../src/editor/editorState';

const left: EditorAsset = { id: 'left', projectId: 'p', name: 'esquerda.mp4', kind: 'video', duration: 5, width: 1920, height: 1080, fps: 30, hasAudio: true, sortOrder: 0 };
const right: EditorAsset = { ...left, id: 'right', name: 'direita.mp4', sortOrder: 1 };

function transfer() {
  const values = new Map<string, string>();
  return {
    files: [],
    setData: (type: string, value: string) => values.set(type, value),
    getData: (type: string) => values.get(type) ?? ''
  };
}

afterEach(cleanup);

describe('editor drag and drop', () => {
  it('drags only the opaque asset id from the media library', () => {
    const dataTransfer = transfer();
    render(<MediaLibrary assets={[left]} selectedId={left.id} importing={false} onSelect={vi.fn()} onImport={vi.fn()} />);
    fireEvent.dragStart(screen.getByRole('button', { name: /esquerda.mp4/i }), { dataTransfer });
    expect(dataTransfer.getData('application/x-mp4-studio-asset')).toBe(left.id);
    expect([...((dataTransfer as unknown as { values?: Map<string, string> }).values ?? [])]).toEqual([]);
  });

  it('drops an asset directly on the chosen side-by-side panel', () => {
    const dataTransfer = transfer();
    dataTransfer.setData('application/x-mp4-studio-asset', right.id);
    const state = { ...createInitialEditorHistory('p', [left, right]).present, tab: 'side-by-side' as const };
    const onSideDrop = vi.fn();
    render(<PreviewMonitor state={state} selected={left} left={left} right={right} onTime={vi.fn()} onSideDrop={onSideDrop} />);
    fireEvent.drop(screen.getByRole('button', { name: 'Soltar mídia no lado direito' }), { dataTransfer });
    expect(onSideDrop).toHaveBeenCalledWith('right', right.id);
  });

  it('drags the side-by-side divider and commits once on release', () => {
    const state = { ...createInitialEditorHistory('p', [left, right]).present, tab: 'side-by-side' as const };
    const onDividerCommit = vi.fn();
    render(<PreviewMonitor state={state} selected={left} left={left} right={right} onTime={vi.fn()} onDividerCommit={onDividerCommit} />);
    const stage = document.querySelector('.monitor-stage') as HTMLElement;
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 500 } as DOMRect);
    const divider = screen.getByRole('slider', { name: 'Divisor lado a lado' });
    fireEvent.pointerDown(divider, { pointerId: 5, clientX: 350 });
    fireEvent.pointerMove(divider, { pointerId: 5, clientX: 450 });
    expect(onDividerCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(divider, { pointerId: 5, clientX: 450 });
    expect(onDividerCommit).toHaveBeenCalledOnce();
    expect(onDividerCommit).toHaveBeenCalledWith(.7);
  });
});
