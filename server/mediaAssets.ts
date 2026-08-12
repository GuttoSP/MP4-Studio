import { spawn } from 'node:child_process';

export async function generateThumbnail(ffmpegPath: string, input: string, output: string): Promise<void> {
  await new Promise<void>((resolveThumbnail, reject) => {
    const child = spawn(ffmpegPath, ['-y', '-ss', '0', '-i', input, '-frames:v', '1', '-vf', 'scale=480:-2:force_original_aspect_ratio=decrease', '-q:v', '3', output], {
      shell: false, windowsHide: true
    });
    let error = '';
    child.stderr.on('data', (chunk) => { error += String(chunk); });
    child.once('error', () => reject(new Error('FFmpeg não está disponível para gerar miniaturas.')));
    child.once('exit', (code) => code === 0 ? resolveThumbnail() : reject(new Error(error.trim() || 'Falha ao gerar miniatura.')));
  });
}
