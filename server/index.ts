import express from 'express';
import multer from 'multer';
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createDefaultMediaTools, databasePath as defaultDatabasePath, dataRoot as defaultDataRoot, host, port, projectRoot, type MediaTools } from './config';
import { createDatabase } from './db';
import { ProjectRepository, RevisionConflictError } from './projectRepository';
import { AssetRepository, publicAsset } from './assetRepository';
import { probeMedia, type MediaMetadata } from './mediaProbe';
import { generateThumbnail } from './mediaAssets';
import { resolveInside } from './pathSafety';
import { RenderRepository } from './renderRepository';
import { RenderQueue } from './renderRunner';
import { buildRenderCommand, outputDescriptor } from './ffmpegCommands';
import { normalizeExport } from '../shared/editorValidation';
import type { NormalizedExport } from '../shared/editorTypes';

export type AppOptions = {
  databasePath?: string;
  dataRoot?: string;
  mediaTools?: MediaTools;
  probe?: (path: string) => Promise<MediaMetadata>;
  thumbnail?: (input: string, output: string) => Promise<void>;
};

export function createApp(options: AppOptions = {}) {
  const app = express();
  const database = createDatabase(options.databasePath ?? defaultDatabasePath);
  const projects = new ProjectRepository(database);
  const assets = new AssetRepository(database);
  const renders = new RenderRepository(database);
  renders.recoverInterrupted();
  const renderQueue = new RenderQueue(renders);
  const editorDataRoot = resolve(options.dataRoot ?? defaultDataRoot);
  const uploadRoot = resolveInside(editorDataRoot, 'uploads');
  mkdirSync(uploadRoot, { recursive: true });
  const upload = multer({ dest: uploadRoot, limits: { files: 20, fileSize: 8 * 1024 * 1024 * 1024 } });
  const mediaToolsPromise = options.mediaTools ? Promise.resolve(options.mediaTools) : createDefaultMediaTools();
  app.locals.database = database;
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/projects', (_request, response) => response.json({ projects: projects.list() }));

  app.post('/api/projects', (request, response) => {
    const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
    if (!name || name.length > 120) {
      response.status(400).json({ error: 'Informe um nome de projeto com até 120 caracteres.' });
      return;
    }
    response.status(201).json(projects.create(name));
  });

  app.get('/api/projects/:id', (request, response) => {
    const project = projects.get(String(request.params.id));
    if (!project) {
      response.status(404).json({ error: 'Projeto não encontrado.' });
      return;
    }
    const projectAssets = assets.list(project.id).map(publicAsset);
    const jobs = database.prepare('SELECT * FROM render_jobs WHERE project_id = ? ORDER BY created_at DESC')
      .all(project.id);
    response.json({ project, assets: projectAssets, jobs });
  });

  app.post('/api/projects/:id/assets', upload.array('files', 20), async (request, response) => {
    const project = projects.get(String(request.params.id));
    const files = request.files as Express.Multer.File[] | undefined;
    if (!project) {
      files?.forEach((file) => rmSync(file.path, { force: true }));
      response.status(404).json({ error: 'Projeto não encontrado.' });
      return;
    }
    if (!files?.length) {
      response.status(400).json({ error: 'Selecione pelo menos uma mídia.' });
      return;
    }
    const accepted = new Set(['.mp4', '.webp', '.png', '.jpg', '.jpeg']);
    const created = [];
    try {
      const mediaTools = await mediaToolsPromise;
      for (const file of files) {
        const extension = extname(file.originalname).toLowerCase();
        if (!accepted.has(extension)) throw new Error(`Formato não suportado: ${file.originalname}.`);
        const id = randomUUID();
        const assetDirectory = resolveInside(editorDataRoot, 'projects', project.id, 'assets');
        const thumbnailDirectory = resolveInside(editorDataRoot, 'projects', project.id, 'thumbnails');
        mkdirSync(assetDirectory, { recursive: true });
        mkdirSync(thumbnailDirectory, { recursive: true });
        const storedName = `${id}${extension}`;
        const storedPath = resolveInside(assetDirectory, storedName);
        renameSync(file.path, storedPath);
        try {
          const metadata = options.probe ? await options.probe(storedPath) : await probeMedia(mediaTools.ffprobePath, storedPath);
          const thumbnailName = `${id}.jpg`;
          const thumbnailPath = resolveInside(thumbnailDirectory, thumbnailName);
          if (options.thumbnail) await options.thumbnail(storedPath, thumbnailPath);
          else await generateThumbnail(mediaTools.ffmpegPath, storedPath, thumbnailPath);
          created.push(assets.create({
            id, projectId: project.id, name: file.originalname, storedName, thumbnailName,
            ...metadata, sortOrder: assets.nextSortOrder(project.id), createdAt: new Date().toISOString()
          }));
        } catch (error) {
          rmSync(storedPath, { force: true });
          throw error;
        }
      }
      response.status(201).json({ assets: assets.list(project.id).map(publicAsset) });
    } catch (error) {
      files.forEach((file) => rmSync(file.path, { force: true }));
      response.status(400).json({ error: error instanceof Error ? error.message : 'Falha ao importar mídia.' });
    }
  });

  app.get('/api/assets/:id/content', (request, response) => {
    const asset = assets.get(String(request.params.id));
    if (!asset) { response.status(404).json({ error: 'Mídia não encontrada.' }); return; }
    response.type(extname(asset.storedName)).sendFile(resolveInside(editorDataRoot, 'projects', asset.projectId, 'assets', asset.storedName));
  });

  app.get('/api/assets/:id/thumbnail', (request, response) => {
    const asset = assets.get(String(request.params.id));
    if (!asset?.thumbnailName) { response.status(404).json({ error: 'Miniatura não encontrada.' }); return; }
    response.type('jpg').sendFile(resolveInside(editorDataRoot, 'projects', asset.projectId, 'thumbnails', asset.thumbnailName));
  });

  app.get('/api/jobs', (request, response) => {
    const projectId = typeof request.query.projectId === 'string' ? request.query.projectId : undefined;
    response.json({ jobs: renders.list(projectId) });
  });

  app.post('/api/jobs/:id/cancel', (request, response) => {
    if (!renderQueue.cancel(String(request.params.id))) {
      response.status(409).json({ error: 'Este render não pode mais ser cancelado.' });
      return;
    }
    response.json(renders.get(String(request.params.id)));
  });

  function estimatedDuration(project: NormalizedExport): number {
    if (project.operation === 'frame') return 1;
    if (project.operation === 'gif') return project.inputs[0].end - project.inputs[0].start;
    if (project.operation === 'side-by-side') {
      const durations = project.inputs.map((input) => input.end - input.start).filter((duration) => duration > 0);
      return project.sideBySide.durationPolicy === 'longest' ? Math.max(...durations) : Math.min(...durations);
    }
    return project.inputs.reduce((sum, input) => sum + input.end - input.start, 0) / project.adjustments.speed;
  }

  app.post('/api/projects/:id/exports', async (request, response) => {
    const project = projects.get(String(request.params.id));
    if (!project) { response.status(404).json({ error: 'Projeto não encontrado.' }); return; }
    try {
      const projectAssets = assets.list(project.id);
      const normalized = normalizeExport({ ...request.body, projectId: project.id }, projectAssets.map(publicAsset));
      const job = renders.create(project.id, normalized.operation, normalized, estimatedDuration(normalized));
      const descriptor = outputDescriptor(normalized);
      const renderDirectory = resolveInside(editorDataRoot, 'projects', project.id, 'renders', job.id);
      mkdirSync(renderDirectory, { recursive: true });
      const partialPath = resolveInside(renderDirectory, `output.partial${descriptor.extension}`);
      const finalPath = resolveInside(renderDirectory, descriptor.fileName);
      const resolvedAssets = projectAssets.map((asset) => ({
        ...publicAsset(asset),
        path: resolveInside(editorDataRoot, 'projects', project.id, 'assets', asset.storedName)
      }));
      const mediaTools = await mediaToolsPromise;
      const command = buildRenderCommand(normalized, resolvedAssets, partialPath);
      command.executable = mediaTools.ffmpegPath;
      renderQueue.enqueue(job.id, command, finalPath, descriptor.fileName);
      response.status(202).json(job);
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : 'Não foi possível iniciar o render.' });
    }
  });

  app.get('/api/jobs/:id/output', (request, response) => {
    const job = renders.get(String(request.params.id));
    if (!job || job.status !== 'completed' || !job.outputName) {
      response.status(404).json({ error: 'Saída não encontrada.' });
      return;
    }
    const outputPath = resolveInside(editorDataRoot, 'projects', job.projectId, 'renders', job.id, job.outputName);
    if (request.query.download === '1') response.download(outputPath, job.outputName);
    else response.sendFile(outputPath);
  });

  app.patch('/api/projects/:id', (request, response) => {
    const expectedRevision = Number(request.body?.expectedRevision);
    const state = request.body?.state;
    if (!Number.isInteger(expectedRevision) || !state || typeof state !== 'object' || Array.isArray(state)) {
      response.status(400).json({ error: 'Estado ou revisão inválidos.' });
      return;
    }
    try {
      response.json(projects.saveState(String(request.params.id), expectedRevision, state, request.body?.name));
    } catch (error) {
      if (error instanceof RevisionConflictError) response.status(409).json({ error: error.message });
      else response.status(404).json({ error: error instanceof Error ? error.message : 'Projeto não encontrado.' });
    }
  });

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
