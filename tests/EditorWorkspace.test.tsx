import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorWorkspace } from '../src/EditorWorkspace';
import type { EditorAsset, EditorProject } from '../shared/types';

const project: EditorProject = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Campanha de verão', status: 'active',
  revision: 0, state: {}, createdAt: '2026-08-12T12:00:00.000Z', updatedAt: '2026-08-12T12:00:00.000Z'
};
const asset: EditorAsset = {
  id: '11111111-1111-4111-8111-111111111111', projectId: project.id, name: 'oceano.mp4',
  kind: 'video', duration: 45, width: 1920, height: 1080, fps: 30, hasAudio: true, sortOrder: 0
};
const coverage: EditorAsset = {
  ...asset,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'cobertura.mp4',
  sortOrder: 1
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('EditorWorkspace', () => {
  it('renders the complete editing surface and adds a kept range', async () => {
    const user = userEvent.setup();
    render(<EditorWorkspace initialProject={project} initialAssets={[asset]} initialJobs={[]} onBack={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Editor MP4' })).toBeVisible();
    expect(screen.getByRole('complementary', { name: 'Mídias' })).toBeVisible();
    for (const label of ['Camadas', 'Cortar', 'Mesclar', 'Lado a lado', 'Crop', 'Frame', 'GIF', 'Ajustes']) {
      expect(screen.getByRole('tab', { name: label })).toBeVisible();
    }
    await user.click(screen.getByRole('tab', { name: 'Camadas' }));
    expect(screen.getByRole('region', { name: 'Timeline multicamadas' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Composição em camadas' })).toBeVisible();
    expect(screen.getByLabelText('Transição')).toHaveValue('none');
    await user.selectOptions(screen.getByLabelText('Transição'), 'dissolve');
    expect(screen.getByLabelText('Duração da transição')).toBeEnabled();
    await user.click(screen.getByRole('tab', { name: 'Cortar' }));
    await user.click(screen.getByRole('button', { name: 'Adicionar trecho' }));
    expect(screen.getAllByText('Trecho 1')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Exportar MP4' })[0]).toBeEnabled();
  });

  it('serializes autosaves so every request uses the latest confirmed revision', async () => {
    vi.useFakeTimers();
    let resolveFirst!: (value: Response) => void;
    const firstResponse = new Promise<Response>((resolve) => { resolveFirst = resolve; });
    const requests: Array<{ expectedRevision: number; state: { tab: string } }> = [];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      if (!init?.method || init.method === 'GET') {
        return { ok: true, json: async () => ({ frames: [] }) } as Response;
      }
      const body = JSON.parse(String(init?.body)) as { expectedRevision: number; state: { tab: string } };
      requests.push(body);
      if (requests.length === 1) return firstResponse;
      return { ok: true, json: async () => ({ ...project, revision: 2, state: body.state }) } as Response;
    });

    render(<EditorWorkspace initialProject={project} initialAssets={[asset]} initialJobs={[]} onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Mesclar' }));
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(requests).toHaveLength(1);

    fireEvent.click(screen.getByRole('tab', { name: 'Crop' }));
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(requests).toHaveLength(1);

    resolveFirst({ ok: true, json: async () => ({ ...project, revision: 1, state: requests[0].state }) } as Response);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(requests).toHaveLength(2);
    expect(requests.map(({ expectedRevision, state }) => ({ expectedRevision, tab: state.tab }))).toEqual([
      { expectedRevision: 0, tab: 'merge' },
      { expectedRevision: 1, tab: 'crop' }
    ]);
  });

  it('previews the winning source and mapped source time at the global playhead', () => {
    const layeredProject: EditorProject = {
      ...project,
      state: {
        tab: 'timeline',
        currentTime: 3,
        selectedAssetId: asset.id,
        tracks: [
          { id: 'top', name: 'Principal', clips: [
            { id: 'top-clip', assetId: asset.id, timelineStart: 0, sourceStart: 0, sourceEnd: 2, enabled: true }
          ] },
          { id: 'bottom', name: 'Cobertura', clips: [
            { id: 'bottom-clip', assetId: coverage.id, timelineStart: 0, sourceStart: 5, sourceEnd: 9, enabled: true }
          ] }
        ]
      }
    };
    render(<EditorWorkspace initialProject={layeredProject} initialAssets={[asset, coverage]} initialJobs={[]} onBack={vi.fn()} />);

    const preview = screen.getByLabelText('Monitor de vídeo').querySelector('video.main-media') as HTMLVideoElement;
    expect(preview).toHaveAttribute('src', `/api/assets/${coverage.id}/content`);
    expect(preview.currentTime).toBe(8);
    expect(screen.getByText('Em exibição: Cobertura · cobertura.mp4')).toBeVisible();
  });
});
