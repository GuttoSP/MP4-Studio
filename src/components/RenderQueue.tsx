import { Check, Download, LoaderCircle, X } from 'lucide-react';
import type { RenderJob } from '../../shared/types';

export function RenderQueue({ jobs, onCancel }: { jobs: RenderJob[]; onCancel: (id: string) => void }) {
  const current = jobs[0];
  if (!current) return <div className="render-bar idle"><span>Nenhum render ainda</span><span>Os resultados aparecerão aqui.</span></div>;
  const active = current.status === 'queued' || current.status === 'running';
  return <section className={`render-bar ${current.status}`} aria-label="Renders">
    <strong>{active ? <><LoaderCircle className="spin" /> Renderizando…</> : current.status === 'completed' ? <><Check /> Concluído</> : <><X /> {current.status === 'cancelled' ? 'Cancelado' : 'Falhou'}</>}</strong>
    <span>{current.operation}</span><div className="progress"><i style={{ width: `${current.progress}%` }} /></div><b>{Math.round(current.progress)}%</b>
    {active ? <button type="button" onClick={() => onCancel(current.id)}>Cancelar</button> : current.status === 'completed' ? <a className="button-link" href={`/api/jobs/${current.id}/output?download=1`}><Download /> Baixar</a> : <span>{current.error}</span>}
  </section>;
}
