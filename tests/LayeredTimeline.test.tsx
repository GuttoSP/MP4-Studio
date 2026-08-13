import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorAsset } from '../shared/types';
import { LayeredTimeline, TIMELINE_CLIP_MIME } from '../src/components/LayeredTimeline';
import { api } from '../src/api';
import { createInitialEditorHistory, type EditorAction } from '../src/editor/editorState';

const first: EditorAsset = {
  id: '11111111-1111-4111-8111-111111111111', projectId: 'p', name: 'principal.mp4',
  kind: 'video', duration: 10, width: 1080, height: 1920, fps: 30, hasAudio: true, sortOrder: 0
};
const second: EditorAsset = {
  ...first, id: '22222222-2222-4222-8222-222222222222', name: 'cobertura.mp4', sortOrder: 1
};

function transfer() {
  const values = new Map<string, string>();
  return {
    files: [],
    types: [] as string[],
    setData(type: string, value: string) { values.set(type, value); this.types = [...values.keys()]; },
    getData: (type: string) => values.get(type) ?? ''
  };
}

function drop(target: Element, dataTransfer: ReturnType<typeof transfer>, clientX: number) {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    dataTransfer: { value: dataTransfer },
    clientX: { value: clientX }
  });
  fireEvent(target, event);
}

function state() {
  return {
    ...createInitialEditorHistory('p', [first, second]).present,
    tab: 'timeline' as const,
    currentTime: 2,
    markIn: 1,
    markOut: 3,
    tracks: [
      { id: 'track-1', name: 'Principal', clips: [
        { id: 'clip-1', assetId: first.id, timelineStart: 0, sourceStart: 0, sourceEnd: 4, enabled: true }
      ] },
      { id: 'track-2', name: 'Cobertura', clips: [
        { id: 'clip-2', assetId: second.id, timelineStart: 2, sourceStart: 0, sourceEnd: 4, enabled: false }
      ] }
    ],
    selectedTrackId: 'track-1',
    selectedClipId: 'clip-1'
  };
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('LayeredTimeline', () => {
  it('shows stacked priority tracks and active or hidden clips', () => {
    render(<LayeredTimeline state={state()} dispatch={vi.fn()} />);

    expect(screen.getByText('Prioridade 1')).toBeVisible();
    expect(screen.getByText('Prioridade 2')).toBeVisible();
    expect(screen.getByRole('button', { name: /principal\.mp4.*visível/i })).toHaveClass('selected');
    expect(screen.getByRole('button', { name: /cobertura\.mp4.*oculto/i })).toHaveClass('disabled');
  });

  it('moves a clip to the chosen track and timeline position by drag and drop', () => {
    const dispatch = vi.fn<(action: EditorAction) => void>();
    const dataTransfer = transfer();
    render(<LayeredTimeline state={state()} dispatch={dispatch} />);
    const lane = screen.getByTestId('timeline-track-track-2');
    vi.spyOn(lane, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 400 } as DOMRect);

    fireEvent.dragStart(screen.getByRole('button', { name: /principal\.mp4.*visível/i }), { dataTransfer });
    expect(dataTransfer.getData(TIMELINE_CLIP_MIME)).toBe('clip-1');
    drop(lane, dataTransfer, 300);

    expect(dispatch).toHaveBeenCalledWith({
      type: 'move-timeline-clip', clipId: 'clip-1', trackId: 'track-2', timelineStart: 3
    });
  });

  it('places a library video at the exact dropped time', () => {
    const dispatch = vi.fn<(action: EditorAction) => void>();
    const dataTransfer = transfer();
    dataTransfer.setData('application/x-mp4-studio-asset', second.id);
    render(<LayeredTimeline state={state()} dispatch={dispatch} />);
    const lane = screen.getByTestId('timeline-track-track-1');
    vi.spyOn(lane, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 400 } as DOMRect);

    drop(lane, dataTransfer, 400);

    expect(dispatch).toHaveBeenCalledWith({
      type: 'place-timeline-clip', trackId: 'track-1', assetId: second.id, timelineStart: 4.5
    });
  });

  it('splits and hides the selected interval from direct toolbar controls', () => {
    const dispatch = vi.fn<(action: EditorAction) => void>();
    render(<LayeredTimeline state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dividir clipe no playhead' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar intervalo marcado' }));

    expect(dispatch).toHaveBeenCalledWith({ type: 'split-timeline-clip', clipId: 'clip-1', time: 2 });
    expect(dispatch).toHaveBeenCalledWith({ type: 'hide-timeline-interval', trackId: 'track-1', start: 1, end: 3 });
  });

  it('shows only distinct temporal frames inside the clip source interval and keeps portrait aspect', async () => {
    vi.spyOn(api, 'listTimelineThumbnails').mockImplementation(async (assetId) => ({ frames: assetId === first.id ? [
      { frameIndex: 0, time: 0, width: 135, height: 240, url: '/frame-0.jpg' },
      { frameIndex: 1, time: 1, width: 135, height: 240, url: '/frame-1.jpg' },
      { frameIndex: 2, time: 2, width: 135, height: 240, url: '/frame-2.jpg' },
      { frameIndex: 3, time: 3, width: 135, height: 240, url: '/frame-3.jpg' },
      { frameIndex: 4, time: 5, width: 135, height: 240, url: '/outside-interval.jpg' }
    ] : [] }));
    render(<LayeredTimeline state={state()} dispatch={vi.fn()} />);
    const clip = screen.getByRole('button', { name: /principal\.mp4.*visível/i });

    await waitFor(() => expect(within(clip).getAllByRole('img')).toHaveLength(4));
    const images = within(clip).getAllByRole('img');
    expect(images.map((image) => image.getAttribute('src'))).toEqual([
      '/frame-0.jpg', '/frame-1.jpg', '/frame-2.jpg', '/frame-3.jpg'
    ]);
    expect(images[0]).toHaveStyle({ aspectRatio: '135 / 240', objectFit: 'contain' });
  });
});
