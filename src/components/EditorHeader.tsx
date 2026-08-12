import { CheckCircle2, ChevronDown, FolderOpen, Menu, Redo2, Undo2, Upload } from 'lucide-react';

type Props = {
  name: string; saveStatus: string; canUndo: boolean; canRedo: boolean; canExport: boolean; exporting: boolean;
  onNameChange: (name: string) => void; onBack: () => void; onUndo: () => void; onRedo: () => void; onExport: () => void;
};

export function EditorHeader({ name, saveStatus, canUndo, canRedo, canExport, exporting, onNameChange, onBack, onUndo, onRedo, onExport }: Props) {
  return (
    <header className="editor-header">
      <button className="icon-button mobile-menu" type="button" aria-label="Projetos" onClick={onBack}><Menu /></button>
      <h1>Editor MP4</h1>
      <label className="project-name"><span className="sr-only">Nome do projeto</span><input value={name} onChange={(event) => onNameChange(event.target.value)} /></label>
      <span className={`save-status ${saveStatus === 'Salvo' ? 'saved' : ''}`}><CheckCircle2 /> {saveStatus}</span>
      <div className="header-history">
        <button className="command-button" type="button" onClick={onUndo} disabled={!canUndo}><Undo2 /> <span>Desfazer</span></button>
        <button className="command-button" type="button" onClick={onRedo} disabled={!canRedo}><Redo2 /> <span>Refazer</span></button>
      </div>
      <button className="project-button" type="button" onClick={onBack}><FolderOpen /> <span>Projetos</span><ChevronDown /></button>
      <button className="export-button" type="button" onClick={onExport} disabled={!canExport || exporting}><Upload /> {exporting ? 'Preparando…' : 'Exportar MP4'}</button>
    </header>
  );
}
