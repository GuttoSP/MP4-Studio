# Timeline Multicamadas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir uma timeline multicamadas em que o primeiro clipe ativo de cima para baixo controla prévia, thumbnails e exportação MP4.

**Architecture:** Um resolvedor puro e compartilhado transforma faixas persistidas em segmentos vencedores. O reducer delega operações não destrutivas a um módulo de edição; React renderiza a mesma composição resolvida que `serializeExport` envia ao backend. O FFmpeg recebe os segmentos na ordem final e usa concat para corte seco ou `xfade`/`acrossfade` para dissolução.

**Tech Stack:** React 19, TypeScript 5.9, Vitest/Testing Library, Express 5, SQLite (`node:sqlite`), FFmpeg/ffprobe e CSS responsivo existente.

## Global Constraints

- Projeto físico: `D:\projetos\editor_mp4` e worktree isolado existente em `D:\projetos\editor_mp4\.worktrees\dynamic-timeline`.
- Persistência no SQLite por meio do `state_json` já versionado; sem banco ou venv adicional.
- Arquivos originais e conteúdo do usuário nunca são modificados, inspecionados ou publicados.
- Corte seco é o padrão; a única transição desta entrega é dissolução global opcional.
- A primeira faixa é sempre a de maior prioridade.
- Preview, faixa Saída e exportação devem consumir o mesmo resolvedor.
- Cada mudança considerável termina em commit e push explícitos, somente com arquivos produzidos nesta implementação.
- TDD obrigatório: cada comportamento novo deve falhar pelo motivo esperado antes de existir código de produção.

---

### Task 1: Tipos e resolvedor puro de prioridade

**Files:**
- Modify: `shared/editorTypes.ts`
- Create: `shared/timelineComposition.ts`
- Create: `tests/timelineComposition.test.ts`

**Interfaces:**
- Produces: `TimelineTrack`, `TimelineLayerClip`, `TimelineTransition`, `ResolvedTimelineSegment`.
- Produces: `resolveTimeline(tracks, assets): ResolvedTimelineSegment[]`.
- Produces: `timelineDuration(tracks): number` and `timelineSegmentAt(segments, time)`.

- [ ] **Step 1: Write the failing priority test**

```ts
it('reveals lower tracks only where every higher track is transparent', () => {
  const tracks = [
    track('t1', clip('c1', 'a1', 0, 0, 10)),
    track('t2', clip('c2a', 'a2', 0, 0, 20), clip('c2b', 'a2', 30, 30, 60)),
    track('t3', clip('c3', 'a3', 0, 0, 60))
  ];
  expect(resolveTimeline(tracks, assets).map(({ assetId, timelineStart, timelineEnd }) =>
    [assetId, timelineStart, timelineEnd]
  )).toEqual([
    ['a1', 0, 10], ['a2', 10, 20], ['a3', 20, 30], ['a2', 30, 60]
  ]);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- tests/timelineComposition.test.ts`

Expected: FAIL because `timelineComposition` and its exported functions do not exist.

- [ ] **Step 3: Add exact timeline types**

```ts
export type TimelineLayerClip = {
  id: string; assetId: string; timelineStart: number;
  sourceStart: number; sourceEnd: number; enabled: boolean;
};
export type TimelineTrack = { id: string; name: string; clips: TimelineLayerClip[] };
export type TimelineTransition = { type: 'none' | 'dissolve'; duration: 0 | 0.25 | 0.5 | 1 };
export type ResolvedTimelineSegment = {
  trackId: string; clipId: string; assetId: string;
  timelineStart: number; timelineEnd: number;
  sourceStart: number; sourceEnd: number;
};
```

- [ ] **Step 4: Implement the boundary resolver**

Use unique sorted clip boundaries, select the first enabled covering clip by track order, map global time to source time, then coalesce continuous adjacent results from the same clip.

- [ ] **Step 5: Add edge-case tests**

Cover disabled clips, exact boundary selection, absent asset IDs, adjacent coalescing and empty intervals.

- [ ] **Step 6: Run focused tests and commit**

Run: `npm test -- tests/timelineComposition.test.ts`

Expected: all resolver tests PASS.

Commit: `feat: resolve layered timeline priority`

---

### Task 2: Edição não destrutiva e hidratação persistível

**Files:**
- Create: `src/editor/timelineEditing.ts`
- Modify: `src/editor/editorState.ts`
- Modify: `tests/editorState.test.ts`
- Create: `tests/timelineEditing.test.ts`

**Interfaces:**
- Consumes: timeline types from Task 1.
- Produces: `createDefaultTimelineTracks`, `placeTimelineClip`, `moveTimelineClip`, `trimTimelineClip`, `splitTimelineClip`, `setTimelineIntervalEnabled`, `removeTimelineClip`.
- Extends `EditorState` with `tracks`, `selectedTrackId`, `selectedClipId`, `timelineTransition`.

- [ ] **Step 1: Write failing default-track and hydration tests**

Assert that three imported videos produce three stable tracks at `00:00`, images do not become video tracks, saved tracks survive hydration, missing assets are removed and newly imported videos append one bottom track without changing existing IDs.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/timelineEditing.test.ts tests/editorState.test.ts`

Expected: FAIL because the state has no `tracks` or layered actions.

- [ ] **Step 3: Implement stable initialization**

Use IDs `track-${asset.id}` and `clip-${asset.id}` only for migration/default creation. User-created IDs use `crypto.randomUUID()`.

- [ ] **Step 4: Write failing edit-operation tests**

Test these exact outcomes:

```ts
splitTimelineClip(clip(0, 0, 60), 20)
// => [timeline 0..20/source 0..20, timeline 20..60/source 20..60]

setTimelineIntervalEnabled(track, 20, 30, false)
// => enabled 0..20, disabled 20..30, enabled 30..60

trimTimelineClip(clip(10, 5, 25), 'start', 14)
// => timelineStart 14, sourceStart 9, sourceEnd 25
```

Also assert that same-track overlap and sub-frame duration return the original collection unchanged.

- [ ] **Step 5: Implement pure editing helpers and reducer actions**

Add actions for add/reorder track, select, insert, split, hide/reveal interval, enable/disable, remove, move and trim clip, plus transition settings. Structural actions participate in undo/redo; selection remains transient.

- [ ] **Step 6: Verify, refactor and commit**

Run: `npm test -- tests/timelineEditing.test.ts tests/editorState.test.ts`

Expected: all state/editing tests PASS.

Commit: `feat: edit and persist layered clips`

---

### Task 3: Contrato de exportação e validação da composição

**Files:**
- Modify: `shared/editorTypes.ts`
- Modify: `shared/editorValidation.ts`
- Modify: `src/editor/editorState.ts`
- Modify: `tests/editorValidation.test.ts`
- Modify: `tests/editorState.test.ts`

**Interfaces:**
- Extends `EditorOperation` with `'timeline'` and `EditorTab` with `'timeline'`.
- Extends request/normalized export with `transition: TimelineTransition`.
- `serializeExport(state)` maps resolved winners to ordered `inputs`.

- [ ] **Step 1: Write failing serialization test**

Use the 0/10/20/30/60 fixture and assert:

```ts
expect(serializeExport(state)).toMatchObject({
  operation: 'timeline',
  inputs: [
    { assetId: 'a1', start: 0, end: 10 },
    { assetId: 'a2', start: 10, end: 20 },
    { assetId: 'a3', start: 20, end: 30 },
    { assetId: 'a2', start: 30, end: 60 }
  ],
  transition: { type: 'none', duration: 0 }
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/editorState.test.ts tests/editorValidation.test.ts`

Expected: FAIL because `timeline` and `transition` are not accepted.

- [ ] **Step 3: Normalize transition safely**

Accept only `none|dissolve` and `0|0.25|0.5|1`. Force `{type:'none', duration:0}` when no effect is selected. Require at least one non-image timeline input belonging to the project.

- [ ] **Step 4: Implement serialization from `resolveTimeline`**

Do not reimplement priority in the reducer. Map only the shared resolved result to export inputs.

- [ ] **Step 5: Test invalid external media and empty composition**

Assert validation errors for an asset from another project, image-only composition and no winner.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- tests/editorState.test.ts tests/editorValidation.test.ts tests/timelineComposition.test.ts`

Expected: all focused tests PASS.

Commit: `feat: serialize layered timeline exports`

---

### Task 4: FFmpeg com corte seco e duração correta

**Files:**
- Modify: `server/ffmpegCommands.ts`
- Modify: `server/index.ts`
- Modify: `tests/ffmpegCommands.test.ts`
- Modify: `tests/ffmpegIntegration.test.ts`

**Interfaces:**
- Adds a timeline render branch to `buildRenderCommand`.
- Adds `timelineOutputDuration(project): number` for command and queue estimate.

- [ ] **Step 1: Write the failing filter-graph test**

Build a normalized timeline with three differently sized assets. Assert one `trim` per winner, target-size `scale/pad/fps`, silence for a segment without audio, `concat=n=4:v=1:a=1`, `shell:false` and duration `60`.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/ffmpegCommands.test.ts`

Expected: FAIL because timeline currently falls through to the single-source cut/merge branch.

- [ ] **Step 3: Implement normalized timeline concat**

Create unique FFmpeg inputs, normalize every segment to the first winner's canvas/FPS, generate 48 kHz stereo audio or `anullsrc`, concatenate, then apply global adjustments and MP4 encoding.

- [ ] **Step 4: Use timeline duration in the API**

Update `estimatedDuration` so queue progress uses sum of winner durations divided by speed.

- [ ] **Step 5: Add a real FFmpeg integration test**

Generate three short colored fixtures with different dimensions and audio presence, render the 1s/1s/1s resolved sequence, then probe H.264, playable duration, even dimensions and AAC audio.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- tests/ffmpegCommands.test.ts tests/ffmpegIntegration.test.ts`

Expected: command and real-media tests PASS.

Commit: `feat: render dry-cut layered timelines`

---

### Task 5: Dissolução opcional

**Files:**
- Modify: `server/ffmpegCommands.ts`
- Modify: `tests/ffmpegCommands.test.ts`
- Modify: `tests/ffmpegIntegration.test.ts`

**Interfaces:**
- Consumes normalized `transition` from Task 3.
- Produces chained `xfade=transition=fade` and `acrossfade` only when enabled.

- [ ] **Step 1: Write a failing dissolve graph test**

For segments of 1s, 2s and 3s with requested duration 1s, assert each boundary clamps to half of the smaller neighbor and the command duration subtracts both overlaps.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/ffmpegCommands.test.ts`

Expected: FAIL because only concat exists.

- [ ] **Step 3: Implement chained video/audio transitions**

Normalize all segments first. Chain `xfade` using accumulated output duration offsets and chain matching `acrossfade`. Preserve concat when type is `none` or fewer than two segments exist.

- [ ] **Step 4: Add a real dissolve integration test**

Render three color clips, probe expected shortened duration and extract frames before/during/after a boundary to prove a playable transition rather than a command-only graph.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/ffmpegCommands.test.ts tests/ffmpegIntegration.test.ts`

Expected: dry and dissolve paths PASS.

Commit: `feat: add optional layered dissolve`

---

### Task 6: Filmstrips paralelas e faixa Saída

**Files:**
- Create: `src/hooks/useTimelineFilmstrips.ts`
- Create: `src/components/timeline/OutputTrack.tsx`
- Create: `tests/OutputTrack.test.tsx`
- Modify: `src/components/Timeline.tsx`

**Interfaces:**
- Produces: `useTimelineFilmstrips(assetIds): {framesByAsset, statusByAsset}`.
- `OutputTrack` consumes resolved segments, duration, assets and filmstrips.

- [ ] **Step 1: Write a failing output-strip test**

Provide the 0/10/20/30/60 composition and frames inside/outside each source interval. Assert only interval-matching frames render, URLs remain distinct and portrait images keep `height:100%; width:auto`.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/OutputTrack.test.tsx`

Expected: FAIL because the hook and output component do not exist.

- [ ] **Step 3: Implement parallel cached loading**

Deduplicate asset IDs, start independent API requests together, reuse the module cache and ignore late results after unmount. Do not fetch sequentially inside track components.

- [ ] **Step 4: Render winner-only output thumbnails**

Position resolved segments by global start/end, filter filmstrip frames by source interval and use complete source aspect. Label each segment with source name and global interval.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/OutputTrack.test.tsx tests/Timeline.test.tsx`

Expected: output and legacy timeline tests PASS.

Commit: `feat: show resolved output filmstrip`

---

### Task 7: Faixas e clipes manipuláveis

**Files:**
- Create: `src/components/timeline/LayerTimeline.tsx`
- Create: `src/components/timeline/LayerTrack.tsx`
- Create: `src/components/timeline/LayerClip.tsx`
- Create: `tests/LayerTimeline.test.tsx`
- Modify: `src/EditorWorkspace.tsx`
- Modify: `src/styles/editor.css`

**Interfaces:**
- `LayerTimeline` receives `state`, resolved segments and `dispatch`.
- `LayerClip` commits `move`, `trim`, `split`, `toggle` and cross-track drop actions; transient pointer values stay local.

- [ ] **Step 1: Write failing semantic/render tests**

Assert an accessible “Saída”, “Faixa 1 — superior”, lower tracks, selected clip controls, hidden state, source-only thumbnails, add-track action and no nested button violations.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/LayerTimeline.test.tsx`

Expected: FAIL because layered components do not exist.

- [ ] **Step 3: Implement the static layered surface**

Render sticky track headers, vertically scrollable rows and a horizontally zoomable canvas. Use `content-visibility:auto` on lower track rows and stable clip keys.

- [ ] **Step 4: Write failing interaction tests**

Test media drop at a computed global time, trim commit only on pointer release, horizontal move, cross-track drop, split at playhead, hide/reveal and delete.

- [ ] **Step 5: Implement pointer and drag/drop interactions**

Use existing `usePointerDrag` for high-frequency pointer drafts and dispatch only at commit. Reject same-track overlap while retaining the original state. Keep numeric fields available in the inspector task.

- [ ] **Step 6: Integrate without breaking legacy tabs**

`EditorWorkspace` renders `LayerTimeline` only for `state.tab === 'timeline'`; existing `Timeline` remains unchanged for the other tools.

- [ ] **Step 7: Verify and commit**

Run: `npm test -- tests/LayerTimeline.test.tsx tests/dragAndDrop.test.tsx tests/Timeline.test.tsx`

Expected: layered and legacy interaction tests PASS.

Commit: `feat: manipulate clips across timeline layers`

---

### Task 8: Prévia guiada pelo vencedor global

**Files:**
- Modify: `src/components/PreviewMonitor.tsx`
- Modify: `src/EditorWorkspace.tsx`
- Modify: `tests/PreviewMonitor.test.tsx`

**Interfaces:**
- `PreviewMonitor` receives optional `compositionPreview` with `asset`, `sourceTime`, `globalTime`, `duration`, `nextBoundary`.
- Emits global time to the editor while media currentTime remains source-relative.

- [ ] **Step 1: Write a failing winner-switch test**

At global `25s`, assert the monitor uses Faixa 3 and seeks its correct source time; at `35s`, assert it switches to Faixa 2. The transport displays the global clock and total timeline duration.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/PreviewMonitor.test.tsx`

Expected: FAIL because preview still follows the selected library asset.

- [ ] **Step 3: Implement composition preview synchronization**

Derive preview data with `timelineSegmentAt`. Seek the video to source-relative time when the winner or global playhead changes. Convert `timeupdate` back to global time and advance across segment boundaries.

- [ ] **Step 4: Preserve existing preview modes**

Side-by-side, crop, frame and selected-asset transport continue using their current behavior outside the timeline tab.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/PreviewMonitor.test.tsx tests/EditorWorkspace.test.tsx`

Expected: global and legacy preview tests PASS.

Commit: `feat: preview winning timeline layer`

---

### Task 9: Inspetor de camadas e exportação pela UI

**Files:**
- Create: `src/components/timeline/TimelineInspector.tsx`
- Modify: `src/components/ToolInspector.tsx`
- Modify: `src/EditorWorkspace.tsx`
- Modify: `tests/EditorWorkspace.test.tsx`
- Modify: `tests/App.test.tsx`

**Interfaces:**
- Adds the `Camadas` tab as the first tool.
- Inspector edits selected clip position/source range, selected track name, mark-in/out hide action and global transition.

- [ ] **Step 1: Write failing inspector/export tests**

Assert Camadas is selected for a new project, fields show selected clip values, “Ocultar intervalo” disables only the marked middle, transition defaults to “Corte seco”, choosing “Dissolver” enables duration and Exportar MP4 sends operation `timeline`.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/EditorWorkspace.test.tsx tests/App.test.tsx`

Expected: FAIL because there is no Camadas inspector or timeline export path.

- [ ] **Step 3: Implement the inspector**

Use controlled numeric inputs with millisecond steps, explicit labels and buttons. Keep errors visible in the existing `inspector-export` alert rather than storing transient UI errors in SQLite.

- [ ] **Step 4: Wire export validation and job polling**

Reuse `normalizeExport(serializeExport(state))`; no separate priority calculation is allowed in the UI.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/EditorWorkspace.test.tsx tests/App.test.tsx tests/editorState.test.ts tests/editorValidation.test.ts`

Expected: workspace and export tests PASS.

Commit: `feat: configure layered timeline exports`

---

### Task 10: Integração total, QA real e documentação

**Files:**
- Modify: `README.md`
- Create or replace: `docs/screenshots/10-timeline-multicamadas-desktop.png`
- Create or replace: `docs/screenshots/11-timeline-camadas-ocultas-desktop.png`
- Create or replace: `docs/screenshots/12-timeline-dissolve-desktop.png`
- Create or replace: `docs/screenshots/13-timeline-multicamadas-mobile.png`

**Interfaces:**
- No new runtime interface; this task proves and documents the integrated behavior.

- [ ] **Step 1: Run the complete automated verification**

Run: `npm test`

Expected: every test file passes, including real FFmpeg dry-cut and dissolve exports.

Run: `npm run build`

Expected: TypeScript and Vite production build pass with no errors.

- [ ] **Step 2: Start an isolated hidden QA server**

Use a verified free localhost port, the ignored project `data` directory and only QA media generated/downloaded for this project. Verify `/api/health` reports SQLite, FFmpeg and ffprobe ready.

- [ ] **Step 3: Reproduce the exact five-layer scenario**

Create five 60-second tracks or equivalent short scaled fixtures. Verify output priority at all boundaries, clip dragging, trimming, split/hide, lower-layer reveal, undo/redo, autosave/reload and winner-driven preview.

- [ ] **Step 4: Export both transition modes**

Export dry cut and dissolve. Require completed jobs, HTTP 200 download, ffprobe codec/duration/dimensions/audio and visual inspection of boundary frames.

- [ ] **Step 5: Capture distinct screenshots**

Use only a temporary isolated browser profile. Capture multicamadas overview, hidden-gap reveal, dissolve setting and honest mobile state. Confirm hashes differ and no MP4, SQLite, temporal JPEG or render appears in Git status.

- [ ] **Step 6: Update README and issues**

Document layered priority, exact 10/20/30 example, interactions, transitions, test instructions and mobile limitations. Open an issue for every newly discovered defect; close it only after a committed regression test and verified fix.

- [ ] **Step 7: Final verification, commit and push**

Run: `git diff --check`, `git status --short`, `npm test`, `npm run build`.

Commit: `docs: demonstrate layered timeline workflow`

Push the feature branch, update PR #13 with test evidence, and leave the worktree intact for PR review.
