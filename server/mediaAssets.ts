import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type GeneratedTimelineThumbnail = {
  frameIndex: number;
  timestampMs: number;
  fileName: string;
  width: number;
  height: number;
};

type TimelineMediaMetadata = {
  duration: number;
  width: number;
  height: number;
};

function even(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

async function runFfmpeg(executable: string, args: string[], failureMessage: string): Promise<void> {
  await new Promise<void>((resolveCommand, reject) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true });
    let error = '';
    child.stderr.on('data', (chunk) => { error += String(chunk); });
    child.once('error', () => reject(new Error('FFmpeg não está disponível para gerar miniaturas.')));
    child.once('exit', (code) => code === 0
      ? resolveCommand()
      : reject(new Error(error.trim() || failureMessage)));
  });
}

export async function generateThumbnail(ffmpegPath: string, input: string, output: string): Promise<void> {
  await runFfmpeg(ffmpegPath, [
    '-y', '-ss', '0', '-i', input, '-frames:v', '1',
    '-vf', 'scale=480:-2:force_original_aspect_ratio=decrease', '-q:v', '3', output
  ], 'Falha ao gerar miniatura.');
}

export async function generateTimelineThumbnails(
  ffmpegPath: string,
  input: string,
  outputDirectory: string,
  metadata: TimelineMediaMetadata
): Promise<GeneratedTimelineThumbnail[]> {
  const duration = Math.max(0.001, metadata.duration);
  const millisecondCapacity = Math.max(1, Math.floor(duration * 1000));
  const count = Math.min(80, Math.max(1, Math.min(Math.max(12, Math.ceil(duration)), millisecondCapacity)));
  const landscape = metadata.width >= metadata.height;
  const longSide = 240;
  const width = landscape ? longSide : even(longSide * metadata.width / metadata.height);
  const height = landscape ? even(longSide * metadata.height / metadata.width) : longSide;
  const scale = landscape
    ? `scale=${longSide}:-2:force_original_aspect_ratio=decrease`
    : `scale=-2:${longSide}:force_original_aspect_ratio=decrease`;

  mkdirSync(outputDirectory, { recursive: true });
  const outputPattern = join(outputDirectory, '%03d.jpg');
  await runFfmpeg(ffmpegPath, [
    '-y', '-i', input, '-vf', `fps=${count / duration},${scale}`,
    '-frames:v', String(count), '-start_number', '0', '-q:v', '3', outputPattern
  ], 'Falha ao gerar quadros da linha do tempo.');

  return Array.from({ length: count }, (_, frameIndex) => {
    const fileName = `${String(frameIndex).padStart(3, '0')}.jpg`;
    if (!existsSync(join(outputDirectory, fileName))) {
      throw new Error(`FFmpeg não gerou o quadro ${frameIndex} da linha do tempo.`);
    }
    return {
      frameIndex,
      timestampMs: Math.min(millisecondCapacity - 1, Math.round(frameIndex * duration * 1000 / count)),
      fileName,
      width,
      height
    };
  });
}
