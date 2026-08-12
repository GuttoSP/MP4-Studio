import type { EditorAsset, EditorProject, RenderJob } from '../shared/types';
import type { ExportRequest } from '../shared/editorTypes';

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? 'A operação não pôde ser concluída.');
  return body as T;
}

export const api = {
  listProjects: () => fetch('/api/projects').then((response) => json<{ projects: EditorProject[] }>(response)),
  createProject: (name: string) => fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then((response) => json<EditorProject>(response)),
  getProject: (id: string) => fetch(`/api/projects/${id}`).then((response) => json<{ project: EditorProject; assets: EditorAsset[]; jobs: RenderJob[] }>(response)),
  saveProject: (project: EditorProject, state: Record<string, unknown>, name: string) => fetch(`/api/projects/${project.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedRevision: project.revision, state, name })
  }).then((response) => json<EditorProject>(response)),
  importAssets: (projectId: string, files: File[]) => {
    const body = new FormData(); files.forEach((file) => body.append('files', file));
    return fetch(`/api/projects/${projectId}/assets`, { method: 'POST', body }).then((response) => json<{ assets: EditorAsset[] }>(response));
  },
  exportProject: (projectId: string, payload: ExportRequest) => fetch(`/api/projects/${projectId}/exports`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  }).then((response) => json<RenderJob>(response)),
  listJobs: (projectId: string) => fetch(`/api/jobs?projectId=${projectId}`).then((response) => json<{ jobs: RenderJob[] }>(response)),
  cancelJob: (id: string) => fetch(`/api/jobs/${id}/cancel`, { method: 'POST' }).then((response) => json<RenderJob>(response))
};
