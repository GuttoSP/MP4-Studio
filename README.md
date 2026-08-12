# MP4 Studio

Editor de vídeo local e orientado a projetos. A interface é feita em React, os projetos são persistidos em SQLite e todo processamento de mídia acontece localmente pelo FFmpeg.

![MP4 Studio no desktop](docs/screenshots/editor-desktop.png)

## Principais recursos

- biblioteca de mídias com importação múltipla e arrastar/soltar;
- suporte a MP4, WebP animado, WebP estático, PNG e JPEG;
- preview, transporte, seek e timeline com miniaturas;
- corte por múltiplos trechos, com remoção e reordenação;
- mesclagem de vídeos com ordem e intervalos independentes;
- composição lado a lado com proporção, divisor, contain/cover, pan, duração e política de áudio;
- crop proporcional com presets 16:9, 9:16, 1:1 e 4:5;
- rotação, espelhamento, velocidade, volume, mute, resolução, FPS e qualidade;
- frame em PNG, JPEG ou WebP;
- GIF animado com intervalo, largura, FPS e loop;
- fila de render com progresso, cancelamento e download;
- desfazer/refazer com histórico de 50 edições;
- salvamento automático e restauração pelo SQLite;
- interface desktop completa; adaptação mobile está planejada no roadmap.

## Galeria de recursos

As imagens abaixo foram capturadas no aplicativo em execução com um vídeo real da costa atlântica ao pôr do sol. O MP4 de demonstração não faz parte do repositório.

| Corte e timeline | Mesclar vídeos |
| --- | --- |
| ![Corte por intervalo e timeline com miniaturas](docs/screenshots/01-corte-e-timeline-desktop.png) | ![Mesclagem de dois vídeos com ordem e intervalos](docs/screenshots/02-mesclar-videos-desktop.png) |

| Lado a lado | Crop vertical |
| --- | --- |
| ![Composição lado a lado com divisor e pan](docs/screenshots/03-lado-a-lado-desktop.png) | ![Crop vertical com preset 4 por 5](docs/screenshots/04-crop-vertical-desktop.png) |

| Extrair frame | Converter para GIF |
| --- | --- |
| ![Extração de frame em JPG e 1080p](docs/screenshots/05-extrair-frame-desktop.png) | ![Conversão de trecho para GIF](docs/screenshots/06-converter-gif-desktop.png) |

| Ajustes de saída | Render concluído |
| --- | --- |
| ![Espelhamento, resolução, FPS e qualidade](docs/screenshots/07-ajustes-exportacao-desktop.png) | ![Fila com render concluído e botão para baixar](docs/screenshots/08-render-concluido-desktop.png) |

## Requisitos

- Windows 10 ou 11;
- Node.js 24 ou superior;
- FFmpeg e ffprobe.

Por padrão, o MP4 Studio procura os executáveis em:

```text
D:\AI\ffmpeg-shared\ffmpeg-master-latest-win64-gpl-shared\bin
```

Quando essa instalação não existe, o aplicativo tenta usar `ffmpeg` e `ffprobe` disponíveis no `PATH` do sistema.

## Instalação

```powershell
git clone https://github.com/GuttoSP/MP4-Studio.git D:\projetos\editor_mp4
cd D:\projetos\editor_mp4
npm install
npm run build
```

## Uso no Windows

1. Dê dois cliques em `iniciar-editor.vbs`.
2. Aguarde alguns segundos.
3. Abra [http://127.0.0.1:43171](http://127.0.0.1:43171).
4. Para encerrar o servidor, execute `parar-editor.vbs`.

Os atalhos iniciam e encerram o servidor sem deixar uma janela de terminal aberta.

Também é possível executar pelo PowerShell:

```powershell
cd D:\projetos\editor_mp4
npm start
```

## Fluxo básico

1. Crie um projeto.
2. Importe um ou mais arquivos na coluna **Mídias**.
3. Selecione uma operação em **Ferramentas**.
4. Ajuste a timeline, intervalos e parâmetros de saída.
5. Clique em **Exportar MP4**, **Extrair frame** ou **Exportar GIF**.
6. Acompanhe o progresso e use **Baixar** quando terminar.

Os arquivos originais nunca são alterados. O aplicativo trabalha com cópias armazenadas no diretório local de dados.

## Interface móvel

A compatibilidade total com celulares ainda não está pronta. A validação em 390 × 844 encontrou overflow horizontal no shell; por isso, a captura mobile anterior foi removida e o trabalho está registrado na [issue #4](https://github.com/GuttoSP/MP4-Studio/issues/4). O desktop é a experiência recomendada nesta versão.

## Mídia da galeria

- **Vídeo:** [Ocean, Sunset, Coastline](https://pixabay.com/videos/ocean-sunset-coastline-drone-174472/)
- **Autor:** [ionela_v](https://pixabay.com/users/ionela_v-43656974/)
- **Fonte e licença:** Pixabay, uso gratuito sob a [Pixabay Content License](https://pixabay.com/service/license-summary/)
- **Uso neste repositório:** somente frames visíveis nos screenshots. O arquivo MP4 original e os recortes de QA permanecem fora do Git.

## Persistência local

O conteúdo do usuário fica somente na máquina local e não é rastreado pelo Git:

```text
data/editor-mp4.sqlite3                    banco SQLite
data/projects/<projeto>/assets             cópias das mídias importadas
data/projects/<projeto>/thumbnails         miniaturas
data/projects/<projeto>/renders            arquivos exportados
```

Além de `data/`, o `.gitignore` exclui logs, resultados de testes, builds e arquivos temporários comuns de editores.

## Desenvolvimento

```powershell
npm run dev
npm test
npm run test:integration
npm run build
```

- frontend de desenvolvimento: `http://127.0.0.1:43170`;
- API e build de produção: `http://127.0.0.1:43171`.

Os testes de integração geram suas próprias mídias sintéticas e validam corte, mesclagem, lado a lado, frame e GIF usando FFmpeg real.

## Privacidade e segurança

- nenhuma mídia é enviada para serviços externos;
- caminhos fornecidos pelo cliente são resolvidos dentro da pasta controlada pelo projeto;
- os comandos FFmpeg são executados sem shell;
- arquivos, banco, logs e renders locais permanecem ignorados pelo Git;
- futuras contribuições automatizadas devem limitar commits a arquivos explicitamente produzidos para a alteração e nunca inspecionar ou publicar conteúdo local do usuário.

## Problemas e sugestões

Use as [Issues do GitHub](https://github.com/GuttoSP/MP4-Studio/issues) para registrar erros reproduzíveis ou propostas de melhoria. Inclua os passos para reproduzir, o resultado esperado e o resultado observado. Não anexe vídeos privados, bancos SQLite, logs pessoais nem conteúdo de projetos reais.

## Licença

Consulte o arquivo [LICENSE](LICENSE).
