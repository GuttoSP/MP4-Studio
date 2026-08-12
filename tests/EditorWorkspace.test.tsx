import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

describe('EditorWorkspace', () => {
  it('renders the complete editing surface and adds a kept range', async () => {
    const user = userEvent.setup();
    render(<EditorWorkspace initialProject={project} initialAssets={[asset]} initialJobs={[]} onBack={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Editor MP4' })).toBeVisible();
    expect(screen.getByRole('complementary', { name: 'Mídias' })).toBeVisible();
    for (const label of ['Cortar', 'Mesclar', 'Lado a lado', 'Crop', 'Frame', 'GIF', 'Ajustes']) {
      expect(screen.getByRole('tab', { name: label })).toBeVisible();
    }
    await user.click(screen.getByRole('button', { name: 'Adicionar trecho' }));
    expect(screen.getAllByText('Trecho 1')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Exportar MP4' })[0]).toBeEnabled();
  });
});
