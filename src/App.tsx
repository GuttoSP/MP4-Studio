import { Film, FolderPlus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { EditorAsset, EditorProject, RenderJob } from '../shared/types';
import { api } from './api';
import { EditorWorkspace } from './EditorWorkspace';
import './styles/tokens.css';
import './styles/app.css';
import './styles/editor.css';

type OpenProject = { project: EditorProject; assets: EditorAsset[]; jobs: RenderJob[] };

export function App() {
  const [projects, setProjects] = useState<EditorProject[]>([]);
  const [open, setOpen] = useState<OpenProject>();
  const [error, setError] = useState('');
  useEffect(() => { void api.listProjects().then(({ projects }) => setProjects(projects)).catch((reason: Error) => setError(reason.message)); }, []);
  const openProject = (id: string) => void api.getProject(id).then(setOpen).catch((reason: Error) => setError(reason.message));
  const create = () => void api.createProject('Novo projeto').then(async (project) => { setProjects((current) => [project, ...current]); setOpen(await api.getProject(project.id)); }).catch((reason: Error) => setError(reason.message));
  if (open) return <EditorWorkspace initialProject={open.project} initialAssets={open.assets} initialJobs={open.jobs} onBack={() => { setOpen(undefined); void api.listProjects().then(({ projects }) => setProjects(projects)); }} />;
  return <main className="project-home"><header><div className="brand"><Film /><h1>Editor MP4</h1></div><button className="export-button" type="button" onClick={create}><Plus /> Novo projeto</button></header><section><div><h2>Seus projetos</h2><p>Continue uma edição ou comece um novo filme. Tudo fica salvo localmente no SQLite.</p></div>{error && <p role="alert" className="home-error">{error}</p>}<div className="project-list">{projects.map((project) => <button type="button" key={project.id} onClick={() => openProject(project.id)}><span><Film /></span><strong>{project.name}</strong><small>Atualizado {new Date(project.updatedAt).toLocaleString('pt-BR')}</small></button>)}<button className="new-project-card" type="button" onClick={create}><FolderPlus /><strong>Novo projeto</strong><small>Importe MP4 e comece a editar.</small></button></div></section></main>;
}
