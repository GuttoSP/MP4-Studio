// @vitest-environment node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildRenderCommand, type ResolvedAsset } from '../server/ffmpegCommands';
import { generateTimelineThumbnails } from '../server/mediaAssets';
import { metadataFromProbe, type ProbeDocument } from '../server/mediaProbe';
import { normalizeExport } from '../shared/editorValidation';

const bin = 'D:\\AI\\ffmpeg-shared\\ffmpeg-master-latest-win64-gpl-shared\\bin';
const bundledFfmpeg = join(bin, 'ffmpeg.exe');
const bundledFfprobe = join(bin, 'ffprobe.exe');
const ffmpeg = existsSync(bundledFfmpeg) ? bundledFfmpeg : 'ffmpeg';
const ffprobe = existsSync(bundledFfprobe) ? bundledFfprobe : 'ffprobe';
const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let directory = '';
let assets: ResolvedAsset[] = [];

function run(args: string[]) {
  execFileSync(ffmpeg, args, { stdio: 'pipe', windowsHide: true, timeout: 60_000 });
}

function inspect(path: string): ProbeDocument {
  return JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_format', '-show_streams', '-print_format', 'json', path], { encoding: 'utf8', windowsHide: true })) as ProbeDocument;
}

beforeAll(() => {
  try {
    execFileSync(ffmpeg, ['-version'], { stdio: 'pipe', windowsHide: true, timeout: 10_000 });
    execFileSync(ffprobe, ['-version'], { stdio: 'pipe', windowsHide: true, timeout: 10_000 });
  } catch {
    throw new Error('FFmpeg e ffprobe não estão disponíveis em D:\\AI nem no PATH.');
  }
  directory = mkdtempSync(join(tmpdir(), 'editor-mp4-ffmpeg-'));
  const first = join(directory, 'first.mp4');
  const second = join(directory, 'second.mp4');
  run(['-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '2.5', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', first]);
  run(['-y', '-f', 'lavfi', '-i', 'color=c=0x6d4aff:size=240x240:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=660:sample_rate=48000', '-t', '2', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', second]);
  assets = [
    { id: '11111111-1111-4111-8111-111111111111', projectId, name: 'first.mp4', kind: 'video', duration: 2.5, width: 320, height: 180, fps: 24, hasAudio: true, sortOrder: 0, path: first },
    { id: '22222222-2222-4222-8222-222222222222', projectId, name: 'second.mp4', kind: 'video', duration: 2, width: 240, height: 240, fps: 24, hasAudio: true, sortOrder: 1, path: second }
  ];
}, 60_000);

afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe('real FFmpeg integration', () => {
  it('extracts distinct full-frame portrait thumbnails at distinct timestamps', async () => {
    const source = join(directory, 'portrait.mp4');
    const output = join(directory, 'portrait-filmstrip');
    run(['-y', '-f', 'lavfi', '-i', 'testsrc2=size=180x320:rate=24', '-t', '1.5', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', source]);

    const frames = await generateTimelineThumbnails(ffmpeg, source, output, { duration: 1.5, width: 180, height: 320 });
    const hashes = frames.map(({ fileName }) => createHash('sha256').update(readFileSync(join(output, fileName))).digest('hex'));

    expect(frames).toHaveLength(12);
    expect(new Set(frames.map(({ timestampMs }) => timestampMs)).size).toBe(frames.length);
    expect(new Set(hashes).size).toBeGreaterThan(1);
    expect(frames.every(({ width, height }) => height > width)).toBe(true);
  }, 60_000);

  it('exports ordered exact cut ranges as playable H.264 MP4 with audio', () => {
    const output = join(directory, 'cut.mp4');
    const project = normalizeExport({ projectId, operation: 'cut', inputs: [
      { assetId: assets[0].id, start: 1.2, end: 1.8 },
      { assetId: assets[0].id, start: 0, end: 0.5 }
    ], output: { quality: 'compact' } }, assets);
    const command = buildRenderCommand(project, assets, output);
    run(command.args);

    const metadata = metadataFromProbe(output, inspect(output));
    expect(metadata.duration).toBeGreaterThan(1);
    expect(metadata.duration).toBeLessThan(1.3);
    expect(metadata).toMatchObject({ kind: 'video', width: 320, height: 180, hasAudio: true });
  }, 60_000);

  it('exports a side-by-side canvas with selected aspect and audio', () => {
    const output = join(directory, 'side.mp4');
    const project = normalizeExport({ projectId, operation: 'side-by-side', inputs: [
      { assetId: assets[0].id, start: 0, end: 0.7 },
      { assetId: assets[1].id, start: 0, end: 0.7 }
    ], output: { height: 720, quality: 'compact' }, sideBySide: { aspect: '16:9', audio: 'first' } }, assets);
    const command = buildRenderCommand(project, assets, output);
    run(command.args);

    expect(metadataFromProbe(output, inspect(output))).toMatchObject({ width: 1280, height: 720, hasAudio: true });
  }, 60_000);

  it('merges clips with different source dimensions into one normalized MP4', () => {
    const output = join(directory, 'merged.mp4');
    const project = normalizeExport({ projectId, operation: 'merge', inputs: [
      { assetId: assets[1].id, start: 0.2, end: 0.8 },
      { assetId: assets[0].id, start: 0, end: 0.7 }
    ], output: { quality: 'compact' } }, assets);
    const command = buildRenderCommand(project, assets, output);
    run(command.args);

    const metadata = metadataFromProbe(output, inspect(output));
    expect(metadata.duration).toBeGreaterThan(1.2);
    expect(metadata).toMatchObject({ width: 240, height: 240, hasAudio: true });
  }, 60_000);

  it('extracts a WebP frame at the selected timestamp', () => {
    const output = join(directory, 'frame.webp');
    const project = normalizeExport({ projectId, operation: 'frame', inputs: [
      { assetId: assets[0].id, start: 0, end: 2 }
    ], frame: { format: 'webp', time: 0.4, height: 720 } }, assets);
    const command = buildRenderCommand(project, assets, output);
    run(command.args);

    const document = inspect(output);
    const video = document.streams?.find((stream) => stream.codec_type === 'video');
    expect(video).toMatchObject({ codec_name: 'webp', width: 1280, height: 720 });
  }, 60_000);

  it('exports an animated GIF with palette generation', () => {
    const output = join(directory, 'clip.gif');
    const project = normalizeExport({ projectId, operation: 'gif', inputs: [
      { assetId: assets[0].id, start: 0, end: 0.6 }
    ], gif: { width: 240, fps: 10, quality: 'compact', loop: true } }, assets);
    const command = buildRenderCommand(project, assets, output);
    run(command.args);

    const document = inspect(output);
    const video = document.streams?.find((stream) => stream.codec_type === 'video');
    expect(video?.codec_name).toBe('gif');
    expect(Number(video?.nb_frames)).toBeGreaterThan(1);
  }, 60_000);
});
