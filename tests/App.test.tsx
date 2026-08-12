import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';

afterEach(() => vi.unstubAllGlobals());

describe('App projects', () => {
  it('creates a project and opens the editor workspace', async () => {
    const user = userEvent.setup();
    const created = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Novo projeto', status: 'active', revision: 0,
      state: {}, createdAt: '2026-08-12T12:00:00.000Z', updatedAt: '2026-08-12T12:00:00.000Z'
    };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/projects' && !init?.method) return new Response(JSON.stringify({ projects: [] }), { status: 200 });
      if (url === '/api/projects' && init?.method === 'POST') return new Response(JSON.stringify(created), { status: 201 });
      if (url === `/api/projects/${created.id}`) return new Response(JSON.stringify({ project: created, assets: [], jobs: [] }), { status: 200 });
      throw new Error(`Unexpected request: ${url}`);
    }));

    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Novo projeto' }));
    expect(await screen.findByText('Sua timeline está vazia')).toBeVisible();
  });
});
