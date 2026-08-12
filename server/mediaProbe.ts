import { spawn } from 'node:child_process';
import { extname } from 'node:path';
import type { AssetKind } from '../shared/types';

type ProbeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  nb_frames?: string;
};

export type ProbeDocument = {
  format?: { duration?: string };
  streams?: ProbeStream[];
};

export type MediaMetadata = {
  kind: AssetKind;
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
};

function rational(value?: string): number {
  if (!value || value === '0/0') return 0;
  const [left, right = 1] = value.split('/').map(Number);
  return Number.isFinite(left) && Number.isFinite(right) && right !== 0 ? left / right : 0;
}

export function metadataFromProbe(fileName: string, document: ProbeDocument): MediaMetadata {
  const streams = document.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === 'video');
  if (!video?.width || !video.height) throw new Error('A mídia não possui um quadro de vídeo válido.');
  const duration = Math.max(0, Number(document.format?.duration ?? 0) || 0);
  const fps = rational(video.avg_frame_rate) || rational(video.r_frame_rate);
  const frames = Math.max(0, Number(video.nb_frames ?? 0) || 0);
  const isWebp = extname(fileName).toLowerCase() === '.webp';
  const animated = isWebp && (duration > 0.05 || frames > 1);
  return {
    kind: isWebp ? (animated ? 'animated-webp' : 'image') : ['.png', '.jpg', '.jpeg'].includes(extname(fileName).toLowerCase()) ? 'image' : 'video',
    duration: Number(duration.toFixed(3)),
    width: video.width,
    height: video.height,
    fps: Number(fps.toFixed(3)),
    hasAudio: streams.some((stream) => stream.codec_type === 'audio')
  };
}

export async function probeMedia(ffprobePath: string, path: string): Promise<MediaMetadata> {
  const document = await new Promise<ProbeDocument>((resolveProbe, reject) => {
    const child = spawn(ffprobePath, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path], {
      shell: false,
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.once('error', () => reject(new Error('ffprobe não está disponível.')));
    child.once('exit', (code) => {
      if (code !== 0) reject(new Error(stderr.trim() || 'Não foi possível analisar a mídia.'));
      else {
        try { resolveProbe(JSON.parse(stdout) as ProbeDocument); }
        catch { reject(new Error('Resposta inválida do ffprobe.')); }
      }
    });
  });
  return metadataFromProbe(path, document);
}
