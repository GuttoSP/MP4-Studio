import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultMediaTools, databasePath as defaultDatabasePath, host, port, projectRoot, type MediaTools } from './config';
import { createDatabase } from './db';

export type AppOptions = {
  databasePath?: string;
  mediaTools?: MediaTools;
};

export function createApp(options: AppOptions = {}) {
  const app = express();
  const database = createDatabase(options.databasePath ?? defaultDatabasePath);
  const mediaToolsPromise = options.mediaTools ? Promise.resolve(options.mediaTools) : createDefaultMediaTools();
  app.locals.database = database;
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', async (_request, response) => {
    const mediaTools = await mediaToolsPromise;
    const result = await mediaTools.check();
    const ok = result.ffmpeg && result.ffprobe;
    response.status(ok ? 200 : 503).json({
      ok,
      sqlite: 'ok',
      ffmpeg: result.ffmpeg ? 'ok' : 'missing',
      ffprobe: result.ffprobe ? 'ok' : 'missing'
    });
  });

  const dist = resolve(projectRoot, 'dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*path', (_request, response) => response.sendFile(resolve(dist, 'index.html')));
  }
  return app;
}

const currentFile = fileURLToPath(import.meta.url);
const executedFile = process.argv[1] ? resolve(process.argv[1]) : '';
if (currentFile === executedFile) {
  createApp().listen(port, host, () => {
    process.stdout.write(`Editor MP4 disponível em http://${host}:${port}\n`);
  });
}
