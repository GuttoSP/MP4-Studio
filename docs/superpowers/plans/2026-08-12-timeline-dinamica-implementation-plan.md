# Timeline dinâmica e filmstrips reais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a edição visual e manipulável, com frames temporais reais, proporção nativa, playhead/trim/crop arrastáveis e drag-and-drop de mídias e clipes.

**Architecture:** O backend extrai e persiste uma filmstrip por asset no SQLite e no diretório controlado do projeto. O frontend mantém o reducer como fonte persistente e usa drafts locais com Pointer Events durante gestos, confirmando uma única mutação no final. Drag and Drop nativo movimenta entidades discretas; Pointer Events manipulam tempo e geometria.

**Tech Stack:** React 19, TypeScript, Vite, Express 5, `node:sqlite`, FFmpeg/ffprobe, Vitest, Testing Library e CSS próprio.

## Global Constraints

- O projeto físico permanece em `D:\projetos\editor_mp4`.
- Não adicionar biblioteca pesada de timeline ou drag-and-drop.
- Originais nunca são sobrescritos.
- Caminhos absolutos nunca são expostos à interface.
- Cada filmstrip usa frames com timestamps e URLs distintos; nunca repetir o poster para simular timeframes.
- Retrato permanece retrato, paisagem permanece paisagem e o quadro completo usa `object-fit: contain`.
- Campos numéricos continuam disponíveis e sincronizados com os gestos.
- Um gesto concluído gera uma única ação de undo e um único autosave.
- Arquivos MP4, SQLite e dados de QA permanecem fora do Git.
- Cada tarefa termina com teste, commit e push explícitos somente dos arquivos da tarefa.

---

### Task 1: Migração e repositório de frames temporais

**Files:**
- Modify: `server/db.ts`
- Create: `server/timelineThumbnailRepository.ts`
- Modify: `shared/types.ts`
- Modify: `tests/db.test.ts`
- Create: `tests/timelineThumbnailRepository.test.ts`

**Interfaces:**
- Produces: `TimelineThumbnail`, `StoredTimelineThumbnail` e `TimelineThumbnailRepository`.
- Produces: migração SQLite versão 2 com cascade por `asset_id`.

- [ ] **Step 1: escrever testes que falham para migração e persistência**

```ts
expect(tables).toContain('timeline_thumbnails');
repository.replaceForAsset(asset.id, [
  { assetId: asset.id, frameIndex: 0, timestampMs: 0, fileName: '000.jpg', width: 135, height: 240 },
  { assetId: asset.id, frameIndex: 1, timestampMs: 500, fileName: '001.jpg', width: 135, height: 240 }
]);
expect(repository.list(asset.id).map((frame) => frame.timestampMs)).toEqual([0, 500]);
```

- [ ] **Step 2: executar `npx vitest run tests/db.test.ts tests/timelineThumbnailRepository.test.ts --maxWorkers=1 --no-file-parallelism` e confirmar falha pela tabela/repositório ausentes**
- [ ] **Step 3: converter `server/db.ts` para migrações sequenciais e implementar a versão 2**

```sql
CREATE TABLE IF NOT EXISTS timeline_thumbnails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  frame_index INTEGER NOT NULL,
  timestamp_ms INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  UNIQUE(asset_id, frame_index),
  UNIQUE(asset_id, timestamp_ms)
);
CREATE INDEX IF NOT EXISTS idx_timeline_thumbnails_asset
  ON timeline_thumbnails(asset_id, frame_index);
```

- [ ] **Step 4: implementar `replaceForAsset`, `list` e `deleteForAsset` em transação**
- [ ] **Step 5: executar os dois testes e depois `npm test`**
- [ ] **Step 6: commit/push `feat: persist timeline thumbnails in sqlite`**

### Task 2: Extração FFmpeg de frames distintos e API opaca

**Files:**
- Modify: `server/mediaAssets.ts`
- Modify: `server/index.ts`
- Modify: `tests/assetApi.test.ts`
- Modify: `tests/ffmpegIntegration.test.ts`

**Interfaces:**
- Produces: `generateTimelineThumbnails(ffmpegPath, input, outputDir, metadata): Promise<GeneratedTimelineThumbnail[]>`.
- Produces: `GET /api/assets/:id/timeline-thumbnails` e `GET /api/assets/:id/timeline-thumbnails/:frameIndex`.

- [ ] **Step 1: escrever teste de API que importa uma mídia, recebe dois frames ordenados e não recebe nomes internos**

```ts
const timeline = await request(app).get(`/api/assets/${assetId}/timeline-thumbnails`);
expect(timeline.body.frames).toEqual([
  { frameIndex: 0, time: 0, width: 135, height: 240, url: `/api/assets/${assetId}/timeline-thumbnails/0` },
  { frameIndex: 1, time: 0.5, width: 135, height: 240, url: `/api/assets/${assetId}/timeline-thumbnails/1` }
]);
```

- [ ] **Step 2: executar o teste da API e confirmar falha 404**
- [ ] **Step 3: implementar a extração em um único processo FFmpeg**

```ts
const count = Math.min(80, Math.max(12, Math.ceil(metadata.duration)));
const fps = count / Math.max(metadata.duration, 0.001);
const scale = metadata.width >= metadata.height
  ? 'scale=240:-2:force_original_aspect_ratio=decrease'
  : 'scale=-2:240:force_original_aspect_ratio=decrease';
const args = ['-y', '-i', input, '-vf', `fps=${fps},${scale}`, '-frames:v', String(count), '-q:v', '3', join(outputDir, '%03d.jpg')];
```

- [ ] **Step 4: na importação, gerar arquivos, medir dimensões, persistir registros e limpar parciais em falha**
- [ ] **Step 5: implementar listagem e streaming com `resolveInside`, sem caminho absoluto no JSON**
- [ ] **Step 6: escrever integração FFmpeg com vídeo `testsrc2` em retrato e verificar hashes/timestamps/dimensões diferentes**

```ts
expect(new Set(frames.map(({ timestampMs }) => timestampMs)).size).toBe(frames.length);
expect(new Set(frames.map(({ sha256 }) => sha256)).size).toBeGreaterThan(1);
expect(frames.every(({ width, height }) => height > width)).toBe(true);
```

- [ ] **Step 7: executar `npx vitest run tests/assetApi.test.ts tests/ffmpegIntegration.test.ts --maxWorkers=1 --no-file-parallelism` e `npm test`**
- [ ] **Step 8: commit/push `feat: generate real timeline filmstrips`**

### Task 3: Cliente e filmstrip responsiva sem repetição

**Files:**
- Modify: `src/api.ts`
- Create: `src/components/timeline/TimelineFilmstrip.tsx`
- Create: `src/components/timeline/TimelineFilmstrip.test.tsx`
- Modify: `src/components/Timeline.tsx`
- Modify: `src/EditorWorkspace.tsx`
- Modify: `src/styles/editor.css`

**Interfaces:**
- Consumes: `TimelineThumbnail` e endpoint da Task 2.
- Produces: `TimelineFilmstrip({ asset, frames, duration, onSeek })`.

- [ ] **Step 1: escrever teste que exige URLs e timestamps distintos e proporção retrato**

```tsx
render(<TimelineFilmstrip asset={portrait} frames={frames} duration={6} onSeek={onSeek} />);
expect(screen.getAllByRole('img')).toHaveLength(frames.length);
expect(screen.getAllByRole('img').map((img) => img.getAttribute('src'))).toEqual(frames.map((frame) => frame.url));
expect(screen.getByTestId('timeline-frame-0')).toHaveStyle({ aspectRatio: '720 / 1280' });
```

- [ ] **Step 2: executar o teste e confirmar falha por componente ausente**
- [ ] **Step 3: adicionar `api.listTimelineThumbnails(assetId)` e cache por asset no workspace**
- [ ] **Step 4: renderizar cada frame exatamente uma vez, com `object-fit: contain` e fundo neutro**
- [ ] **Step 5: remover `Array.from({ length: 12 })` e qualquer repetição de `/thumbnail` em `Timeline.tsx`**
- [ ] **Step 6: adicionar loading e erro explícito; nunca usar poster repetido como fallback**
- [ ] **Step 7: executar o teste, `npm test` e `npm run build`**
- [ ] **Step 8: commit/push `feat: render native-aspect timeline filmstrips`**

### Task 4: Matemática temporal, zoom e playhead arrastável

**Files:**
- Create: `src/components/timeline/timelineMath.ts`
- Create: `tests/timelineMath.test.ts`
- Create: `src/hooks/usePointerDrag.ts`
- Create: `src/components/timeline/TimelinePlayhead.tsx`
- Modify: `src/components/Timeline.tsx`
- Modify: `src/editor/editorState.ts`
- Modify: `tests/editorState.test.ts`

**Interfaces:**
- Produces: `timeFromPointer(clientX, trackLeft, trackWidth, duration)`, `snapTime(time, fps, duration)` e `clampTime`.
- Produces: `TimelinePlayhead` com draft local e `onCommit(time)`.

- [ ] **Step 1: escrever testes para clamp e snap**

```ts
expect(timeFromPointer(350, 100, 500, 20)).toBe(10);
expect(snapTime(1.02, 25, 10)).toBe(1.04);
expect(snapTime(12, 25, 10)).toBe(10);
```

- [ ] **Step 2: executar e confirmar falha por funções ausentes**
- [ ] **Step 3: implementar funções puras e `usePointerDrag` com captura de ponteiro**
- [ ] **Step 4: tornar régua, filmstrip e playhead arrastáveis; confirmar apenas no fim do gesto**
- [ ] **Step 5: adicionar `timelineZoom` ao estado persistente e conectar botões, slider e `Ctrl+wheel`**
- [ ] **Step 6: testar que um scrub completo não entra no undo e que a mudança de zoom entra uma vez**
- [ ] **Step 7: executar testes e build**
- [ ] **Step 8: commit/push `feat: add draggable playhead and real timeline zoom`**

### Task 5: Handles de trim e reordenação visual

**Files:**
- Create: `src/components/timeline/TimelineClip.tsx`
- Create: `src/components/timeline/TimelineClip.test.tsx`
- Modify: `src/components/Timeline.tsx`
- Modify: `src/components/ToolInspector.tsx`
- Modify: `src/editor/editorState.ts`
- Modify: `tests/editorState.test.ts`
- Modify: `src/styles/editor.css`

**Interfaces:**
- Consumes: `snapTime` e `usePointerDrag`.
- Produces: handles ARIA, trim atômico e reordenação `reorder-range`/`reorder-merge-asset`.

- [ ] **Step 1: escrever testes do reducer para trim válido, limite de um frame e reordenação**

```ts
history = editorReducer(history, { type: 'commit-range-trim', id, start: 2, end: 7 });
expect(history.present.ranges[0]).toMatchObject({ start: 2, end: 7 });
expect(history.past).toHaveLength(1);
```

- [ ] **Step 2: executar e confirmar falha pelas ações ausentes**
- [ ] **Step 3: implementar ações atômicas no reducer**
- [ ] **Step 4: implementar `TimelineClip` com body draggable, handles `role="slider"` e draft local**
- [ ] **Step 5: substituir setas de ordem do inspetor por cartões drag-and-drop mantendo as setas como alternativa acessível**
- [ ] **Step 6: testar pointer, teclado e drag/drop**
- [ ] **Step 7: executar testes e build**
- [ ] **Step 8: commit/push `feat: add draggable trim handles and clip ordering`**

### Task 6: Drag de mídia para timeline e lado a lado

**Files:**
- Modify: `src/components/MediaLibrary.tsx`
- Create: `src/components/SideBySideDropZones.tsx`
- Create: `src/components/SideBySideDropZones.test.tsx`
- Modify: `src/components/PreviewMonitor.tsx`
- Modify: `src/components/Timeline.tsx`
- Modify: `src/EditorWorkspace.tsx`
- Modify: `src/editor/editorState.ts`

**Interfaces:**
- Produces: payload MIME `application/x-mp4-studio-asset` contendo somente `assetId`.
- Produces: ações `insert-range`, `insert-merge-asset` e atribuição por lado.

- [ ] **Step 1: escrever teste que arrasta um `assetId` e destaca/aciona o destino correto**
- [ ] **Step 2: executar e confirmar falha porque os cartões ainda não são `draggable`**
- [ ] **Step 3: tornar cada `media-row` uma origem de drag sem interferir no clique**
- [ ] **Step 4: criar zonas de drop na timeline por ferramenta ativa e inserir no índice apontado**
- [ ] **Step 5: criar zonas esquerda/direita no monitor e atualizar `sideLeftAssetId`/`sideRightAssetId`**
- [ ] **Step 6: testar drop inválido, mídia duplicada e alternativa por select**
- [ ] **Step 7: executar testes e build**
- [ ] **Step 8: commit/push `feat: drag media into editing targets`**

### Task 7: Crop e divisor manipuláveis no monitor

**Files:**
- Create: `src/components/CropManipulator.tsx`
- Create: `src/components/CropManipulator.test.tsx`
- Modify: `src/components/PreviewMonitor.tsx`
- Modify: `src/components/ToolInspector.tsx`
- Modify: `src/styles/editor.css`

**Interfaces:**
- Consumes: crop normalizado `{ x, y, width, height }`.
- Produces: `onCropCommit(crop)` e `onDividerCommit(divider)` atômicos.

- [ ] **Step 1: escrever testes de movimento, resize, clamp e trava de proporção**
- [ ] **Step 2: executar e confirmar falha por manipulador ausente**
- [ ] **Step 3: calcular limites a partir do retângulo real da mídia com `object-fit: contain`**
- [ ] **Step 4: implementar corpo movível e oito handles com Pointer Events**
- [ ] **Step 5: sincronizar presets/campos e adicionar modo livre explícito**
- [ ] **Step 6: tornar o divisor lado a lado arrastável e manter o slider sincronizado**
- [ ] **Step 7: executar testes e build**
- [ ] **Step 8: commit/push `feat: manipulate crop and split directly on preview`**

### Task 8: QA real, documentação e screenshots

**Files:**
- Modify: `README.md`
- Modify: `docs/design/design-system.md`
- Modify: `docs/screenshots/*.png`

**Interfaces:**
- Consumes: todos os recursos anteriores.
- Produces: evidência pública do fluxo visual atualizado.

- [ ] **Step 1: executar `npm test`, `npm run test:integration` e `npm run build`**
- [ ] **Step 2: iniciar instância isolada com SQLite de QA em porta livre e confirmar `/api/health`**
- [ ] **Step 3: importar um vídeo 16:9 e um 9:16 e verificar via API que timestamps/URLs não se repetem**
- [ ] **Step 4: no navegador isolado, testar o fluxo: importar → arrastar → scrub → trim → reordenar → crop → salvar → reabrir → exportar**
- [ ] **Step 5: capturar e inspecionar screenshots desktop mostrando filmstrips paisagem e retrato completas**
- [ ] **Step 6: auditar console, overflow, foco, labels, proporção, ausência de thumbs repetidas e estado após reabertura**
- [ ] **Step 7: atualizar README e design system com gestos, atalhos e persistência**
- [ ] **Step 8: confirmar que `git ls-files` não contém MP4/SQLite e que apenas arquivos esperados serão staged**
- [ ] **Step 9: commit/push `docs: document dynamic editing workflow`**
- [ ] **Step 10: confirmar HEAD remoto, repositório limpo e encerrar somente a instância de QA criada nesta execução**
