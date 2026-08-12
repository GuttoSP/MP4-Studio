# Editor MP4 Visual System

## Reference Screens

- Desktop: `editor-desktop-concept.png`, 1514 × 1054.
- Mobile: `editor-mobile-concept.png`, 853 × 1844.

The desktop concept is authoritative for density, panel geometry and timeline anatomy. The mobile concept is authoritative for collapse order and touch layout. Text inside the React application remains code-native.

## Color Lock

- `--bg: #090d10` — true cool charcoal app background.
- `--surface-1: #0f1418` — primary rails and inspector.
- `--surface-2: #141a1f` — fields, rows and selected timeline clips.
- `--surface-3: #1a2026` — hover and active neutral states.
- `--border: #303840` — standard one-pixel divider.
- `--border-strong: #46515a` — focused neutral outline.
- `--text: #f4f6f8` — primary copy.
- `--text-muted: #949ca5` — metadata and captions.
- `--violet: #8b5cf6` — primary action and selected tool.
- `--violet-soft: #a982ff` — text/outline accent.
- `--green: #9bea52` — playhead, saved and success.
- `--danger: #ff6b77` — destructive actions and errors.

No warm tint, glass blur, neon glow or broad decorative gradient is allowed. The export button may use a very subtle violet vertical value shift solely to preserve the concept's depth.

## Typography

- Family: `Inter`, `Segoe UI`, system sans-serif; no external font request.
- App title: 18 px / 700 / 1.2.
- Panel title: 15 px / 700 / 1.25.
- Body and controls: 13 px / 500 / 1.4.
- Compact labels and metadata: 11–12 px / 500 / 1.35.
- Timecode: tabular numerals, 14–16 px / 600.
- Timeline ruler: tabular numerals, 10–11 px / 500.

Control typography is explicitly set; browser defaults are not accepted.

## Geometry

- Desktop header: 58 px.
- Desktop library: 250 px.
- Desktop inspector: 330 px.
- Desktop timeline: 250–280 px depending on viewport height.
- Mobile header: 56 px; monitor keeps the source aspect ratio; timeline scrolls horizontally; inspector becomes a bottom section.
- Radius: 6 px controls, 8 px rows, 10 px mobile sections.
- Spacing scale: 4, 8, 12, 16, 20, 24 px.
- Buttons: minimum 36 px desktop and 44 px touch height.
- Borders: 1 px; panels use dividers instead of floating cards.

## Component Families

- Command button: neutral, icon-only, destructive and violet primary variants.
- Field: label above, dark input/select, precise focus outline.
- Tool tabs: text tabs with violet underline; horizontally scrollable on mobile.
- Media row: thumbnail, file name and two metadata lines; no card shadow.
- Timeline clip: dark-violet fill, violet outline, green trim handles and ordered index.
- Transport: outline icons in a borderless row; the play icon is larger.
- Status: icon plus text, never a decorative pill.
- Render row: label, codec/size metadata, progress track, percent, remaining time and cancel/download action.

## Icon Inventory

Use Lucide outline icons at 1.75 px stroke: menu, folder, upload, undo, redo, scissors, trash, crop, plus, skip-back, rewind, play, fast-forward, skip-forward, camera, volume, fullscreen, zoom-out, zoom-in, settings, download, pause, X. Selected icons inherit violet; success uses green; destructive uses danger.

## Allowed Primary Copy

`Editor MP4`, `Novo projeto`, `Projetos`, `Salvo`, `Salvando…`, `Mídias`, `Adicionar mídia`, `Ferramentas`, `Cortar`, `Mesclar`, `Lado a lado`, `Crop`, `Frame`, `GIF`, `Ajustes`, `Entrada`, `Saída`, `Adicionar trecho`, `Trechos mantidos`, `Exportar MP4`, `Renderizando…`, `Cancelar`, `Baixar`.

Additional visible copy is allowed only when required by the documented workflow, validation or accessibility. There is no marketing headline, tagline, analytics strip, badge row or fake dashboard content.

## Responsive Continuation

At 900 px and below, the media library is collapsed behind `Mídias (N)`, the monitor moves above the timeline, and the inspector follows the timeline. At 600 px and below, the header keeps the product name, current project, saved state and export action; secondary actions move into compact icon controls. Timeline content has a stable minimum width and horizontal scrolling rather than unreadable compression.

## Motion

Use 120–180 ms opacity/background/border transitions. The playhead and progress track may animate linearly. Under `prefers-reduced-motion: reduce`, all nonessential transition durations become zero.
