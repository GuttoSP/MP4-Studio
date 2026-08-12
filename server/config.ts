import { access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const dataRoot = resolve(projectRoot, 'data');
export const databasePath = resolve(dataRoot, 'editor-mp4.sqlite3');
export const host = '127.0.0.1';
export const port = Number(process.env.EDITOR_MP4_PORT || 43171);

const preferredBin = 'D:\\AI\\ffmpeg-shared\\ffmpeg-master-latest-win64-gpl-shared\\bin';

export type MediaCheck = { ffmpeg: boolean; ffprobe: boolean };

export type MediaTools = {
  ffmpegPath: string;
  ffprobePath: string;
  check: () => Promise<MediaCheck>;
};

async function usableFile(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

export async function executableWorks(executable: string): Promise<boolean> {
  return new Promise((resolveCheck) => {
    const child = spawn(executable, ['-version'], { shell: false, windowsHide: true });
    const timeout = setTimeout(() => {
      child.kill();
      resolveCheck(false);
    }, 5_000);
    child.once('error', () => {
      clearTimeout(timeout);
      resolveCheck(false);
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      resolveCheck(code === 0);
    });
  });
}

export async function createDefaultMediaTools(): Promise<MediaTools> {
  const preferredFfmpeg = resolve(preferredBin, 'ffmpeg.exe');
  const preferredFfprobe = resolve(preferredBin, 'ffprobe.exe');
  const ffmpegPath = await usableFile(preferredFfmpeg) ? preferredFfmpeg : 'ffmpeg';
  const ffprobePath = await usableFile(preferredFfprobe) ? preferredFfprobe : 'ffprobe';
  return {
    ffmpegPath,
    ffprobePath,
    check: async () => {
      const [ffmpeg, ffprobe] = await Promise.all([
        executableWorks(ffmpegPath),
        executableWorks(ffprobePath)
      ]);
      return { ffmpeg, ffprobe };
    }
  };
}
