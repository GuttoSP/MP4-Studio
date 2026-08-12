# Editor MP4 Design

## Objetivo

Criar um aplicativo local e independente em `D:\projetos\editor_mp4` para edição prática de MP4. O projeto reaproveita o conjunto de recursos e as lições do editor do ComfyUI Central, mas não depende do ComfyUI e não altera seu repositório, processo, porta ou fila. Projetos, rascunhos e renders ficam persistidos em SQLite 3; FFmpeg e ffprobe executam todo o processamento no próprio PC.

## Abordagens avaliadas

1. Copiar integralmente o ComfyUI Central e remover os módulos alheios ao editor. É rápido no início, mas traz dependências, navegação, estados e dívida técnica que não pertencem ao novo produto.
2. Extrair o editor como pacote compartilhado entre os dois projetos. Evita duplicação, mas cria acoplamento entre um repositório em uso e o novo aplicativo, além de exigir uma refatoração fora do escopo.
3. Criar um aplicativo dedicado e portar apenas contratos, regras FFmpeg e comportamentos já validados. É a abordagem escolhida porque mantém o produto pequeno, autônomo e seguro, permitindo melhorar a interface e adicionar SQLite sem interferir no ComfyUI Central.

## Escopo funcional

O editor suporta:

- importar MP4 e WebP animado como vídeo, além de PNG, JPG, JPEG e WebP estático para composições;
- selecionar e conservar um ou vários trechos com precisão de milissegundos;
- aparar início/fim e reorganizar os trechos mantidos;
- mesclar dois ou mais vídeos na ordem exibida, com cortes independentes por clipe;
- compor vídeo + vídeo ou imagem + vídeo lado a lado;
- recortar o quadro com área livre ou presets 16:9, 9:16, 1:1 e 4:5;
- extrair o frame atual em PNG, JPG ou WebP;
- converter um trecho em GIF com controle de tamanho, FPS, qualidade e loop;
- rotacionar, espelhar, alterar velocidade, remover/ajustar áudio, resolução, FPS e qualidade;
- desfazer/refazer as últimas 50 alterações;
- salvar automaticamente, fechar e reabrir projetos;
- acompanhar, cancelar, baixar e consultar o histórico de renders.

O primeiro ciclo não inclui IA generativa, publicação em redes sociais, edição externa do ComfyUI, waveform editável, legendas, texto animado, chroma key ou uma timeline arbitrária de múltiplas faixas. Esses recursos exigem contratos próprios e não são necessários para preservar todo o escopo já comprovado no editor original.

## Experiência de uso

A tela usa uma linguagem visual escura, limpa e de alto contraste, com detalhes em violeta e verde, tipografia legível e densidade adequada a uma ferramenta de desktop. A hierarquia é:

- barra superior com seletor de projeto, nome editável, estado de salvamento, desfazer/refazer e novo projeto;
- biblioteca de mídia à esquerda, com importação por botão ou arrastar e soltar, miniaturas, duração, resolução e áudio;
- monitor central com preview fiel de crop, rotação, espelhamento e composição;
- inspetor contextual à direita com ferramentas organizadas em `Cortar`, `Mesclar`, `Lado a lado`, `Crop`, `Frame`, `GIF` e `Ajustes`;
- timeline inferior com miniaturas, playhead, marcadores de entrada/saída e blocos de trechos mantidos;
- gaveta de renders com progresso, estado, erro, cancelar e baixar.

Em telas estreitas, biblioteca e inspetor viram painéis recolhíveis e o monitor/timeline permanecem prioritários. Todos os controles têm rótulo acessível, foco visível, alvo de toque adequado e alternativa numérica aos gestos. Atalhos: Espaço reproduz/pausa, setas navegam, `I` marca entrada, `O` marca saída, Delete remove o trecho selecionado, Ctrl+Z desfaz e Ctrl+Shift+Z refaz.

## Arquitetura

### Frontend

- React 19, TypeScript e Vite.
- Estado de edição em reducer puro e serializável.
- Um cliente `fetch` tipado; o volume de endpoints não justifica adicionar uma biblioteca de cache remoto.
- Componentes focados por responsabilidade: shell, biblioteca, monitor, timeline, inspetor, projetos e fila de renders.
- CSS próprio com tokens de cor, espaçamento, tipografia e breakpoints; não há dependência de um kit visual externo.

### Backend

- Express 5 escutando exclusivamente em `127.0.0.1`.
- SQLite 3 via módulo nativo `node:sqlite` do Node 24 instalado, com WAL, foreign keys e migrações versionadas.
- Upload multipart com Multer e arquivos guardados somente sob `data/projects/<project-id>`.
- `ffprobe` classifica mídia e coleta duração, dimensões, FPS e presença de áudio.
- `ffmpeg` é iniciado com `spawn` e array de argumentos, nunca com shell.
- Caminho preferencial: `D:\AI\ffmpeg-shared\ffmpeg-master-latest-win64-gpl-shared\bin`; o PATH é apenas fallback validado.
- Em desenvolvimento, Vite usa proxy para a API. Em produção local, Express serve `dist` e a API na mesma origem.

### Banco SQLite

O arquivo é `data/editor-mp4.sqlite3`. Migrações criam:

- `schema_migrations`: versão aplicada;
- `projects`: nome, status, timestamps, mídia selecionada e estado serializado atual;
- `assets`: projeto, nome original, nome armazenado, tipo, metadados, ordem e miniatura;
- `project_revisions`: últimas revisões serializadas para recuperação e auditoria local;
- `render_jobs`: payload normalizado, status, fase, progresso, saída, erro e timestamps.

O banco guarda metadados e estado; arquivos grandes ficam no sistema de arquivos e são referenciados por caminhos relativos validados. O autosave usa debounce de 400 ms e controle de revisão para impedir que uma resposta antiga sobrescreva uma edição mais nova.

## Fluxo de dados

1. O usuário cria/abre um projeto.
2. A importação copia arquivos para a área controlada, executa probe e miniaturas e grava o asset em uma transação SQLite.
3. Cada mutação relevante atualiza o reducer imediatamente e agenda autosave no backend.
4. Ao exportar, o backend valida IDs, propriedade dos assets, limites e payload; cria um job persistido e um snapshot dos inputs.
5. O runner executa FFmpeg, interpreta `-progress pipe:2` e atualiza SQLite.
6. O frontend consulta a fila enquanto houver trabalho ativo; ao concluir, oferece preview e download.
7. Falha, cancelamento ou reinício preservam o histórico e removem apenas saídas parciais controladas.

## Contratos HTTP

- `GET /api/health`: Node, SQLite, FFmpeg e ffprobe.
- `GET /api/projects`: lista projetos recentes.
- `POST /api/projects`: cria projeto.
- `GET /api/projects/:id`: projeto, estado, assets e jobs.
- `PATCH /api/projects/:id`: renomeia ou salva estado com revisão esperada.
- `DELETE /api/projects/:id`: exclui somente dados controlados e recusa quando houver render ativo.
- `POST /api/projects/:id/assets`: importa até 20 arquivos.
- `GET /api/assets/:id/content`: streaming com byte ranges.
- `GET /api/assets/:id/thumbnail`: miniatura.
- `DELETE /api/assets/:id`: remove asset sem uso por render ativo.
- `POST /api/projects/:id/exports`: valida e cria render.
- `GET /api/jobs`: lista renders recentes.
- `POST /api/jobs/:id/cancel`: cancelamento idempotente.
- `GET /api/jobs/:id/output`: preview/download com content type correto.

O navegador nunca envia nem recebe caminhos absolutos. IDs são UUIDs opacos e toda resolução de caminho deve permanecer sob o diretório `data` do projeto.

## FFmpeg e regras de exportação

- Corte e múltiplos trechos usam `trim/setpts`, `atrim/asetpts` e concatenação exata com reencode.
- Mesclagem normaliza canvas, FPS, pixels e áudio; clipes sem áudio recebem silêncio quando necessário.
- Lado a lado permite `Conter`/`Preencher`, pan independente, divisor ajustável, duração pelo menor/maior e áudio da esquerda/direita/mix/nenhum.
- MP4 usa H.264, `yuv420p`, `+faststart` e AAC; qualidade mapeia para CRF 18, 23 ou 28.
- GIF usa `palettegen` e `paletteuse`.
- Crop e escalas produzem dimensões pares.
- Originais nunca são sobrescritos. Saídas são gravadas primeiro como arquivo parcial e promovidas somente após sucesso.

## Erros e recuperação

A interface diferencia mídia corrompida/não suportada, WebP estático em operação de vídeo, trecho inválido, crop impossível, composição incompleta, falta de FFmpeg, falta de espaço, conflito de revisão, render cancelado, interrompido e falho. Jobs `queued` ou `running` encontrados no startup passam para `interrupted`; nenhum processo externo é encerrado.

## Testes

- Unitários: validação de payload, reducer, undo/redo, serialização, migrações, repositórios SQLite, resolução segura de caminhos e montagem dos argumentos FFmpeg.
- Componentes: todas as ferramentas, importação, projetos, autosave, bloqueios de exportação e fila de renders.
- Integração: banco real temporário, API, fixtures sintéticas e FFmpeg/ffprobe reais sem GPU e sem ComfyUI.
- E2E/visual: Playwright headless com perfil temporário isolado em 1440x1000 e 390x844, incluindo importação, edição, autosave, reabertura e exportação.
- Build: TypeScript e Vite em modo de produção.

## Critérios de aceite

- O projeto existe apenas em `D:\projetos\editor_mp4` e inicia sem alterar o ComfyUI Central.
- SQLite persiste projetos, estado, assets e renders entre reinícios.
- Todo o conjunto de ferramentas do editor existente funciona ponta a ponta com FFmpeg real.
- A interface é utilizável em desktop e mobile, sem controles inertes.
- Originais permanecem intactos e nenhum caminho arbitrário pode escapar da área do projeto.
- Testes, integração FFmpeg, build e QA visual passam com evidência atual.
