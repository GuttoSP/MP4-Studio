# Editor MP4

Editor de vídeo local em React, com projetos persistidos em SQLite e renderização pelo FFmpeg instalado em `D:\AI`.

## Abrir

1. Dê dois cliques em `iniciar-editor.vbs`.
2. Aguarde alguns segundos.
3. Abra `http://127.0.0.1:43171` no navegador de sua preferência.

Para encerrar o servidor, dê dois cliques em `parar-editor.vbs`. Os dois atalhos trabalham sem abrir janelas de terminal.

Também é possível iniciar pelo terminal:

```powershell
cd D:\projetos\editor_mp4
npm start
```

## Recursos

- biblioteca por projeto com importação múltipla e arrastar/soltar;
- MP4, WebP animado, WebP estático, PNG e JPEG;
- preview, transporte, seek e timeline com miniaturas;
- corte por múltiplos trechos conservados e reordenáveis;
- mesclagem de vídeos com intervalos e ordem configuráveis;
- composição lado a lado com proporção, divisor, contain/cover, pan, duração e política de áudio;
- crop proporcional com presets 16:9, 9:16, 1:1 e 4:5;
- rotação, espelhamento, velocidade, volume, mute, resolução, FPS e qualidade;
- extração de frame em PNG, JPEG ou WebP;
- GIF animado com intervalo, largura, FPS, loop e qualidade;
- fila de render com progresso, cancelamento e download;
- desfazer/refazer com histórico de 50 edições;
- salvamento automático e restauração integral do projeto pelo SQLite;
- layout responsivo para desktop e celular.

## Persistência local

- banco SQLite: `data\editor-mp4.sqlite3`;
- mídias copiadas: `data\projects\<projeto>\assets`;
- miniaturas: `data\projects\<projeto>\thumbnails`;
- renders concluídos: `data\projects\<projeto>\renders`.

O editor nunca altera os arquivos de origem. A pasta `data` não entra no Git.

## Desenvolvimento e testes

```powershell
npm install
npm run dev
npm test
npm run test:integration
npm run build
```

O frontend de desenvolvimento usa `http://127.0.0.1:43170`; a API e a versão de produção usam `http://127.0.0.1:43171`.
