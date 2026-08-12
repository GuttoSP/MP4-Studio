export type ProjectStatus = 'active' | 'archived';
export type AssetKind = 'video' | 'animated-webp' | 'image';
export type RenderStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';

export type EditorProject = {
  id: string;
  name: string;
  status: ProjectStatus;
  revision: number;
  state: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type EditorAsset = {
  id: string;
  projectId: string;
  name: string;
  kind: AssetKind;
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  sortOrder: number;
};

export type RenderJob = {
  id: string;
  projectId: string;
  status: RenderStatus;
  operation: string;
  progress: number;
  phase: string;
  outputName?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};
