import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { EditorAsset, EditorProject, RenderJob } from '../shared/types';
import { normalizeExport } from '../shared/editorValidation';
import { api } from './api';
import { createInitialEditorHistory, editorReducer, serializeExport, type EditorState } from './editor/editorState';
import { EditorHeader } from './components/EditorHeader';
import { MediaLibrary } from './components/MediaLibrary';
import { PreviewMonitor } from './components/PreviewMonitor';
import { Timeline } from './components/Timeline';
import { ToolInspector } from './components/ToolInspector';
import { RenderQueue } from './components/RenderQueue';

type Props = { initialProject: EditorProject; initialAssets: EditorAsset[]; initialJobs: RenderJob[]; onBack: () => void };

function restoredState(project: EditorProject, assets: EditorAsset[]): Partial<EditorState> | undefined {
  if (!project.state || !Object.keys(project.state).length) return undefined;
  return { ...(project.state as Partial<EditorState>), assets, projectId: project.id };
}

export function EditorWorkspace({ initialProject, initialAssets, initialJobs, onBack }: Props) {
  const [project, setProject] = useState(initialProject);
  const [name, setName] = useState(initialProject.name);
  const [history, dispatch] = useReducer(editorReducer, undefined, () => {
    let seed = createInitialEditorHistory(initialProject.id, initialAssets);
    const saved = restoredState(initialProject, initialAssets);
    if (saved) seed = editorReducer(seed, { type: 'hydrate', projectId: initialProject.id, assets: initialAssets, state: saved });
    return seed;
  });
  const state = history.present;
  const [jobs, setJobs] = useState(initialJobs);
  const [saveStatus, setSaveStatus] = useState('Salvo');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [localError, setLocalError] = useState('');
  const hydrated = useRef(false);
  const saveQueue = useRef(Promise.resolve(initialProject));
  const selected = state.assets.find((asset) => asset.id === state.selectedAssetId);
  const left = state.assets.find((asset) => asset.id === state.sideLeftAssetId);
  const right = state.assets.find((asset) => asset.id === state.sideRightAssetId);

  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return; }
    setSaveStatus('Salvando…');
    const timer = window.setTimeout(() => {
      saveQueue.current = saveQueue.current.then(async (confirmedProject) => {
        try {
          const saved = await api.saveProject(confirmedProject, state as unknown as Record<string, unknown>, name);
          setProject(saved); setSaveStatus('Salvo');
          return saved;
        } catch (error) {
          setSaveStatus('Conflito');
          setLocalError(error instanceof Error ? error.message : 'Falha ao salvar o projeto.');
          return confirmedProject;
        }
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [state, name]);

  useEffect(() => {
    if (!jobs.some((job) => job.status === 'queued' || job.status === 'running')) return;
    const timer = window.setInterval(() => void api.listJobs(project.id).then(({ jobs: current }) => setJobs(current)), 800);
    return () => window.clearInterval(timer);
  }, [jobs, project.id]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.ctrlKey && event.key.toLowerCase() === 'z') { event.preventDefault(); dispatch({ type: event.shiftKey ? 'redo' : 'undo' }); }
      if (event.key.toLowerCase() === 'i') dispatch({ type: 'set-markers', markIn: state.currentTime, markOut: state.markOut });
      if (event.key.toLowerCase() === 'o') dispatch({ type: 'set-markers', markIn: state.markIn, markOut: state.currentTime });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.currentTime, state.markIn, state.markOut]);

  const exportError = useMemo(() => {
    try { normalizeExport(serializeExport(state), state.assets); return ''; }
    catch (error) { return error instanceof Error ? error.message : 'Revise o projeto.'; }
  }, [state]);

  async function importFiles(files: File[]) {
    if (!files.length) return;
    setImporting(true); setLocalError('');
    try {
      const { assets } = await api.importAssets(project.id, files);
      dispatch({ type: 'hydrate', projectId: project.id, assets, state });
    } catch (error) { setLocalError(error instanceof Error ? error.message : 'Falha ao importar.'); }
    finally { setImporting(false); }
  }

  async function exportNow() {
    if (exportError) { setLocalError(exportError); return; }
    setExporting(true); setLocalError('');
    try { const job = await api.exportProject(project.id, serializeExport(state)); setJobs((current) => [job, ...current]); }
    catch (error) { setLocalError(error instanceof Error ? error.message : 'Falha ao exportar.'); }
    finally { setExporting(false); }
  }

  return <main className="editor-app">
    <EditorHeader name={name} saveStatus={saveStatus} canUndo={history.past.length > 0} canRedo={history.future.length > 0} canExport={!exportError} exporting={exporting} onNameChange={setName} onBack={onBack} onUndo={() => dispatch({ type: 'undo' })} onRedo={() => dispatch({ type: 'redo' })} onExport={() => void exportNow()} />
    <div className="editor-layout">
      <MediaLibrary assets={state.assets} selectedId={state.selectedAssetId} importing={importing} onSelect={(assetId) => dispatch({ type: 'select-asset', assetId })} onImport={(files) => void importFiles(files)} />
      <div className="center-workspace"><PreviewMonitor state={state} selected={selected} left={left} right={right} onTime={(time) => dispatch({ type: 'set-current-time', time })} onSideDrop={(side, assetId) => dispatch({ type: 'set-side-assets', left: side === 'left' ? assetId : state.sideLeftAssetId, right: side === 'right' ? assetId : state.sideRightAssetId })} /><Timeline state={state} asset={selected?.kind === 'image' ? undefined : selected} onSeek={(time) => dispatch({ type: 'set-current-time', time })} onZoom={(zoom) => dispatch({ type: 'set-timeline-zoom', zoom })} onAdd={() => dispatch({ type: 'add-range' })} onRemove={(id) => dispatch({ type: 'remove-range', id })} onUpdate={(id, start, end) => dispatch({ type: 'commit-range-trim', id, start, end })} onReorder={(id, beforeId) => dispatch({ type: 'reorder-range', id, beforeId })} onAssetDrop={(assetId) => dispatch({ type: 'insert-range', assetId })} /></div>
      <ToolInspector state={state} selected={selected} error={localError || exportError} dispatch={dispatch} onExport={() => void exportNow()} exporting={exporting} />
    </div>
    <RenderQueue jobs={jobs} onCancel={(id) => void api.cancelJob(id).then((job) => setJobs((items) => items.map((item) => item.id === id ? job : item)))} />
  </main>;
}
