# Interações dinâmicas e timeline visual — Design

## Objetivo

Transformar o MP4 Studio em um editor predominantemente visual e manipulável. Digitação de tempo, duração e coordenadas continua disponível para precisão, mas as operações principais passam a acontecer por arrastar, soltar, mover, aparar e selecionar diretamente na biblioteca, timeline e monitor.

Este design preserva o reducer serializável, o autosave com revisão no SQLite, o histórico de desfazer/refazer e os contratos FFmpeg existentes.

## Requisitos obrigatórios

- mídias podem ser arrastadas da biblioteca para os destinos válidos da ferramenta ativa;
- clipes e trechos podem ser reordenados por arrastar e soltar;
- entrada e saída podem ser alteradas por handles visuais na timeline;
- o playhead pode ser arrastado e atualiza o preview continuamente;
- zoom e rolagem da timeline afetam de verdade a escala temporal;
- crop pode ser movido e redimensionado diretamente sobre o vídeo;
- valores numéricos continuam disponíveis e sempre ficam sincronizados com os gestos;
- cada célula da filmstrip usa um frame extraído em um tempo diferente do vídeo;
- uma imagem estática não pode ser repetida artificialmente para simular vários timeframes;
- miniaturas preservam a proporção nativa: vídeo retrato produz miniaturas retrato, vídeo paisagem produz miniaturas paisagem;
- o frame completo aparece com `object-fit: contain`, sem crop oculto;
- estado persistente continua no SQLite e mídias continuam fora do Git.

## Abordagens avaliadas

### 1. Somente HTML Drag and Drop

É suficiente para mover mídias entre painéis e reordenar listas, mas inadequado para playhead, trim e crop contínuos. A experiência fica inconsistente entre gestos.

### 2. Drag and Drop nativo + Pointer Events

Abordagem escolhida. Drag and Drop movimenta entidades discretas, como mídia e clipe. Pointer Events controlam gestos contínuos, como seek, trim e crop. Não adiciona dependência pesada, funciona com mouse, caneta e toque, e permite manter estado transitório local durante o gesto.

### 3. Biblioteca completa de timeline

Entrega muitos comportamentos prontos, mas impõe um modelo de dados próprio, aumenta o bundle e cria acoplamento desnecessário com o pipeline atual de ranges e FFmpeg. Não será usada nesta etapa.

## Modelo de interação

### Biblioteca de mídias

- Cada mídia é selecionável e `draggable`.
- O cartão usa a proporção nativa da mídia e mostra o frame inteiro.
- Durante um arraste, destinos compatíveis recebem destaque e texto curto de ação.
- Soltar na timeline de corte cria um trecho com a duração integral da mídia.
- Soltar na timeline de mesclagem adiciona ou reposiciona o clipe na sequência.
- Soltar sobre os lados esquerdo ou direito do monitor atribui a mídia à composição lado a lado.
- Clique continua selecionando a mídia sem iniciar um gesto.

### Timeline

A timeline terá uma régua temporal real, uma filmstrip de frames amostrados, o playhead e uma faixa de clipes/trechos.

- Clicar ou arrastar na régua/filmstrip move o playhead.
- O playhead tem área de captura maior que a linha visível.
- Cada trecho possui handle esquerdo e direito para trim.
- Arrastar o corpo do trecho muda sua ordem na sequência; durante o gesto, um indicador mostra a posição de inserção.
- O trim faz snap ao frame quando o FPS é conhecido e a 10 ms quando não é.
- `Shift` desativa temporariamente o snap.
- Zoom altera a relação pixels/segundo e habilita rolagem horizontal real.
- `Ctrl` + roda do mouse aplica zoom ancorado na posição do ponteiro.
- O valor final de cada gesto é enviado ao reducer apenas no `pointerup`/`drop`, produzindo uma única revisão, uma única entrada de undo e um único autosave.
- Durante o movimento, um draft local atualiza a interface sem gravar centenas de estados intermediários.

### Filmstrip sem repetição artificial

Na importação, o backend gera uma sequência real de frames distribuídos pela duração da mídia.

- Quantidade: `min(80, max(12, ceil(duração_em_segundos)))` para vídeos; mídias muito curtas recebem amostragem subsegundo.
- Cada registro tem timestamp próprio e arquivo próprio.
- Os timestamps percorrem o vídeo em ordem e nunca repetem a mesma URL para preencher espaço.
- A UI renderiza cada frame disponível uma única vez e dimensiona a faixa conforme duração e zoom.
- Vídeos retrato usam células estreitas em proporção retrato; vídeos paisagem usam células largas em proporção paisagem.
- `object-fit: contain` garante a exibição integral, com fundo neutro quando sobra espaço.
- Se a geração falhar, a importação informa o erro; não substitui silenciosamente toda a sequência pelo poster repetido.

### Mesclagem

- A lista numérica do inspetor passa a ser uma representação auxiliar da mesma sequência visual da timeline.
- Clipes são reordenados arrastando na faixa.
- Handles ajustam início/fim de cada clipe.
- Soltar nova mídia entre clipes insere exatamente naquele ponto.
- Campos numéricos permanecem disponíveis para ajuste fino.

### Lado a lado

- O monitor exibe duas zonas de drop explícitas quando a ferramenta está ativa.
- A mídia pode ser arrastada da biblioteca para qualquer lado.
- O divisor central pode ser arrastado diretamente.
- Pan de cada lado é feito arrastando a imagem dentro da metade correspondente.
- Selects e sliders continuam como alternativa precisa e acessível.

### Crop direto

- A área de crop é movível pelo centro.
- Quatro handles de canto e quatro laterais redimensionam a seleção.
- Presets travam a proporção até o usuário escolher modo livre.
- A interação usa os limites reais do vídeo renderizado no monitor, não os limites externos do painel.
- Coordenadas normalizadas continuam sendo persistidas e enviadas ao FFmpeg.

## Arquitetura de frontend

Novos módulos focados:

- `TimelineFilmstrip`: régua e frames temporais;
- `TimelinePlayhead`: seek por Pointer Events;
- `TimelineClip`: seleção, trim e drag;
- `TimelineDropZone`: inserção e reordenação;
- `CropManipulator`: movimento e resize normalizados;
- `SideBySideDropZones`: atribuição e divisor;
- `usePointerDrag`: ciclo de gesto com draft transitório e commit final;
- `timelineMath`: conversão tempo/pixel, clamp, snap e posição de inserção.

O reducer continua sendo a fonte de verdade persistente. Estado de hover, posição transitória e coordenadas durante um gesto ficam localmente nos componentes ou em refs para evitar rerenders e autosaves desnecessários.

Novas ações do reducer:

- `insert-range`;
- `reorder-range`;
- `commit-range-trim`;
- `set-timeline-zoom`;
- `insert-merge-asset`;
- `reorder-merge-asset`.

`timelineZoom`, trecho selecionado e sequência permanecem serializáveis no estado do projeto. Hover e draft de ponteiro não são persistidos.

## SQLite e thumbnails

A migração 2 adiciona:

```sql
CREATE TABLE timeline_thumbnails (
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
```

Os JPEGs ficam em `data/projects/<project-id>/thumbnails/<asset-id>/`. O banco guarda somente metadados e nomes relativos validados.

Novo contrato:

- `GET /api/assets/:id/timeline-thumbnails`: lista ordenada com `time`, `width`, `height` e URL opaca de cada frame;
- `GET /api/assets/:id/timeline-thumbnails/:frameIndex`: entrega o JPEG correspondente.

A geração usa um único processo FFmpeg por mídia, preserva o aspect ratio e limita o lado maior. Nenhum caminho absoluto é exposto ao navegador.

## Erros e recuperação

- Drop inválido é recusado visualmente e não altera o projeto.
- Trim nunca ultrapassa a duração nem cruza o outro handle.
- Um trecho tem duração mínima de um frame.
- Falha na geração de filmstrip remove arquivos parciais e não cria registros incompletos.
- Assets antigos sem filmstrip podem gerar seus frames na primeira abertura e gravá-los no SQLite.
- Autosave continua serializado; somente commits finais de gesto geram revisão.

## Acessibilidade

- Todo gesto possui alternativa por teclado ou campo numérico.
- Handles têm `role="slider"`, valores ARIA e foco visível.
- Clipes podem ser reordenados com `Alt` + setas.
- Playhead responde às setas e `Shift` + setas para passos maiores.
- Zonas de drop informam o destino e o resultado esperado.
- Movimento respeita `prefers-reduced-motion`.

## Estratégia de testes

- Unitários para tempo/pixel, snap por FPS, clamp, trim, inserção e reordenação.
- Reducer para garantir uma única entrada de undo por gesto concluído.
- Componentes para playhead arrastável, handles, drop de mídia e reordenação.
- SQLite para migração e cascade dos frames temporais.
- API para importação, listagem e streaming opaco das thumbnails.
- Integração FFmpeg para provar timestamps diferentes, dimensões preservadas e retrato/paisagem corretos.
- Teste visual com um vídeo paisagem e um retrato, confirmando frames completos e diferentes ao longo da filmstrip.
- Fluxo ponta a ponta: importar, arrastar para timeline, aparar, reordenar, crop direto, salvar, reabrir e exportar.

## Critérios de aceite

- Nenhuma filmstrip repete uma única thumbnail estática para representar tempos diferentes.
- Frames consecutivos têm timestamps distintos e URLs distintas.
- Vídeo 9:16 produz thumbnails 9:16 completas; vídeo 16:9 produz thumbnails 16:9 completas.
- Playhead, trims, clipes, crop e divisor lado a lado respondem a arrastar.
- Biblioteca aceita drop de arquivos e oferece mídias como origem de drag.
- Campos numéricos refletem imediatamente cada gesto e podem sobrescrevê-lo.
- Reabrir o projeto restaura timeline, ranges, ordem, zoom e crop pelo SQLite.
- Undo desfaz cada gesto completo em uma etapa.
- Testes, build, FFmpeg real e QA visual passam antes da publicação.
