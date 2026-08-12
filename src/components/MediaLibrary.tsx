import { Film, Image, Plus, Upload } from 'lucide-react';
import type { ChangeEvent, DragEvent } from 'react';
import type { EditorAsset } from '../../shared/types';

const time = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

type Props = { assets: EditorAsset[]; selectedId: string; importing: boolean; onSelect: (id: string) => void; onImport: (files: File[]) => void };

export function MediaLibrary({ assets, selectedId, importing, onSelect, onImport }: Props) {
  const choose = (event: ChangeEvent<HTMLInputElement>) => { onImport(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ''; };
  const drop = (event: DragEvent) => { event.preventDefault(); onImport(Array.from(event.dataTransfer.files)); };
  return (
    <aside className="media-library" aria-label="Mídias" onDragOver={(event) => event.preventDefault()} onDrop={drop}>
      <div className="panel-heading"><strong>Mídias</strong><label className="add-media"><Plus /> Adicionar mídia<input aria-label="Adicionar mídia" type="file" accept=".mp4,.webp,.png,.jpg,.jpeg" multiple onChange={choose} disabled={importing} /></label></div>
      {assets.length === 0 ? <label className="media-empty"><Upload /><strong>Sua timeline está vazia</strong><span>Arraste MP4 aqui ou escolha arquivos.</span><input aria-label="Escolher arquivos" type="file" accept=".mp4,.webp,.png,.jpg,.jpeg" multiple onChange={choose} /></label> : (
        <div className="media-list">{assets.map((asset) => <button className={`media-row ${asset.id === selectedId ? 'selected' : ''}`} type="button" key={asset.id} onClick={() => onSelect(asset.id)}>
          <span className="media-thumb"><img src={`/api/assets/${asset.id}/thumbnail`} alt="" />{asset.kind === 'image' ? <Image /> : <Film />}<small>{asset.kind === 'image' ? 'IMG' : time(asset.duration)}</small></span>
          <span className="media-copy"><strong title={asset.name}>{asset.name}</strong><small>{asset.width}×{asset.height}</small><small>{asset.kind === 'image' ? 'Imagem' : `${Math.round(asset.fps)} FPS${asset.hasAudio ? ' · Áudio' : ''}`}</small></span>
        </button>)}</div>
      )}
      <footer>{assets.length} {assets.length === 1 ? 'item' : 'itens'}</footer>
    </aside>
  );
}
