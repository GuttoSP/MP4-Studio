import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorAsset } from '../shared/types';
import { Timeline } from '../src/components/Timeline';
import { createInitialEditorHistory } from '../src/editor/editorState';

const portraitAsset: EditorAsset = {
  id: 'portrait-video',
  projectId: 'project',
  name: 'retrato.mp4',
  kind: 'video',
  duration: 3,
  width: 1080,
  height: 1920,
  fps: 30,
  hasAudio: true,
  sortOrder: 0
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Timeline filmstrip', () => {
  it('renders one distinct complete portrait thumbnail for each temporal frame', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        frames: [
          { frameIndex: 0, time: 0, width: 108, height: 192, url: '/frames/0' },
          { frameIndex: 1, time: 1, width: 108, height: 192, url: '/frames/1' },
          { frameIndex: 2, time: 2, width: 108, height: 192, url: '/frames/2' }
        ]
      })
    } as Response);
    const state = createInitialEditorHistory('project', [portraitAsset]).present;

    render(<Timeline state={state} asset={portraitAsset} onSeek={vi.fn()} onAdd={vi.fn()} onRemove={vi.fn()} />);

    const strip = screen.getByRole('button', { name: 'Navegar pelos quadros do vídeo' });
    await waitFor(() => expect(within(strip).getAllByRole('img')).toHaveLength(3));
    const frames = within(strip).getAllByRole('img');
    expect(frames.map((frame) => frame.getAttribute('src'))).toEqual(['/frames/0', '/frames/1', '/frames/2']);
    expect(screen.getByTestId('timeline-frame-0')).toHaveStyle({ aspectRatio: '108 / 192' });
    expect(frames[0]).toHaveClass('timeline-frame-image');
    expect(frames.every((frame) => frame.getAttribute('src') !== `/api/assets/${portraitAsset.id}/thumbnail`)).toBe(true);
  });

  it('scrubs by pointer and commits a snapped playhead time', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ frames: [] }) } as Response);
    const state = createInitialEditorHistory('project', [portraitAsset]).present;
    const onSeek = vi.fn();
    render(<Timeline state={state} asset={portraitAsset} onSeek={onSeek} onAdd={vi.fn()} onRemove={vi.fn()} />);
    const canvas = screen.getByTestId('timeline-canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 600 } as DOMRect);

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 400 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 550 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 550 });

    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenLastCalledWith(2.267);
  });
});
