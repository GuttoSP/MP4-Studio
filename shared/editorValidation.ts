import type { EditorAsset } from './types';
import type { Adjustments, CropRect, EditorOperation, ExportRequest, NormalizedExport } from './editorTypes';

const operations: EditorOperation[] = ['cut', 'merge', 'side-by-side', 'frame', 'gif'];
const rotations = [0, 90, 180, 270] as const;
const heights = [0, 720, 1080, 1440, 2160] as const;
const outputFps = [0, 24, 25, 30, 60] as const;
const qualities = ['high', 'balanced', 'compact'] as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function finite(value: unknown, fallback: number, label: string): number {
  if (value == null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} inválido.`);
  return number;
}

function bounded(value: unknown, fallback: number, minimum: number, maximum: number, label: string): number {
  const number = finite(value, fallback, label);
  if (number < minimum || number > maximum) throw new Error(`${label} deve ficar entre ${minimum} e ${maximum}.`);
  return number;
}

function choice<T extends string | number>(value: unknown, fallback: T, allowed: readonly T[], label: string): T {
  if (value == null || value === '') return fallback;
  if (!allowed.includes(value as T)) throw new Error(`${label} inválido.`);
  return value as T;
}

function crop(value: unknown): CropRect {
  const source = record(value);
  const result = {
    x: bounded(source.x, 0, 0, 1, 'Posição X do crop'),
    y: bounded(source.y, 0, 0, 1, 'Posição Y do crop'),
    width: bounded(source.width, 1, 0.01, 1, 'Largura do crop'),
    height: bounded(source.height, 1, 0.01, 1, 'Altura do crop')
  };
  if (result.x + result.width > 1.000001 || result.y + result.height > 1.000001) {
    throw new Error('A área de crop ultrapassa o quadro.');
  }
  return result;
}

export function normalizeExport(input: ExportRequest, assets: EditorAsset[]): NormalizedExport {
  const operation = choice(input.operation, 'cut', operations, 'Operação');
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  if (!input.projectId) throw new Error('Projeto inválido.');
  if (!Array.isArray(input.inputs) || input.inputs.length === 0) throw new Error('Selecione uma mídia.');
  const pairs = input.inputs.map((raw) => {
    const asset = byId.get(raw.assetId);
    if (!asset || asset.projectId !== input.projectId) throw new Error('Mídia não encontrada neste projeto.');
    if (asset.kind === 'image') return { asset, input: { assetId: asset.id, start: 0, end: 0 } };
    const start = finite(raw.start, 0, 'Início');
    const end = finite(raw.end, asset.duration, 'Fim');
    if (start < 0 || end <= start || end > asset.duration + 0.001) throw new Error(`Trecho inválido para ${asset.name}.`);
    return { asset, input: { assetId: asset.id, start: Math.round(start * 1000) / 1000, end: Math.round(end * 1000) / 1000 } };
  });
  const selected = pairs.map(({ asset }) => asset);
  if (operation === 'cut' && (selected.some((asset) => asset.kind === 'image') || new Set(selected.map(({ id }) => id)).size !== 1)) {
    throw new Error('Corte exige trechos de um único vídeo.');
  }
  if (operation === 'merge' && (selected.length < 2 || selected.some((asset) => asset.kind === 'image'))) {
    throw new Error('Mesclagem exige pelo menos dois vídeos.');
  }
  if (operation === 'side-by-side') {
    if (selected.length !== 2 || selected[0].id === selected[1].id) throw new Error('Lado a lado exige duas mídias diferentes.');
    if (selected.every((asset) => asset.kind === 'image')) throw new Error('Lado a lado exige pelo menos um vídeo.');
  }
  if ((operation === 'frame' || operation === 'gif') && (selected.length !== 1 || selected[0].kind === 'image')) {
    throw new Error(`${operation === 'frame' ? 'Frame' : 'GIF'} exige um vídeo.`);
  }

  const rawAdjustments = record(input.adjustments);
  const adjustments: Adjustments = {
    crop: crop(rawAdjustments.crop),
    rotation: choice(rawAdjustments.rotation, 0, rotations, 'Rotação'),
    flipHorizontal: Boolean(rawAdjustments.flipHorizontal),
    flipVertical: Boolean(rawAdjustments.flipVertical),
    speed: bounded(rawAdjustments.speed, 1, 0.5, 2, 'Velocidade'),
    muted: Boolean(rawAdjustments.muted),
    volume: bounded(rawAdjustments.volume, 1, 0, 2, 'Volume')
  };
  const output = record(input.output);
  const side = record(input.sideBySide);
  const frame = record(input.frame);
  const gif = record(input.gif);
  return {
    projectId: input.projectId,
    operation,
    inputs: pairs.map((pair) => pair.input),
    adjustments,
    output: {
      height: choice(output.height, 0, heights, 'Resolução'),
      fps: choice(output.fps, 0, outputFps, 'FPS'),
      quality: choice(output.quality, 'balanced', qualities, 'Qualidade')
    },
    sideBySide: {
      aspect: choice(side.aspect, '16:9', ['16:9', '9:16', '1:1', '4:5'] as const, 'Proporção'),
      divider: bounded(side.divider, 0.5, 0.2, 0.8, 'Divisor'),
      leftFit: choice(side.leftFit, 'contain', ['contain', 'cover'] as const, 'Enquadramento'),
      rightFit: choice(side.rightFit, 'contain', ['contain', 'cover'] as const, 'Enquadramento'),
      leftPanX: bounded(side.leftPanX, 0.5, 0, 1, 'Pan esquerdo X'),
      leftPanY: bounded(side.leftPanY, 0.5, 0, 1, 'Pan esquerdo Y'),
      rightPanX: bounded(side.rightPanX, 0.5, 0, 1, 'Pan direito X'),
      rightPanY: bounded(side.rightPanY, 0.5, 0, 1, 'Pan direito Y'),
      durationPolicy: choice(side.durationPolicy, 'shortest', ['shortest', 'longest'] as const, 'Duração'),
      audio: choice(side.audio, 'first', ['first', 'second', 'mix', 'none'] as const, 'Áudio')
    },
    frame: {
      time: bounded(frame.time, pairs[0].input.start, 0, selected[0].duration, 'Tempo do frame'),
      format: choice(frame.format, 'png', ['png', 'jpg', 'webp'] as const, 'Formato do frame'),
      height: choice(frame.height, 0, heights, 'Altura do frame')
    },
    gif: {
      width: bounded(gif.width, 640, 64, 1920, 'Largura do GIF'),
      fps: bounded(gif.fps, 15, 1, 30, 'FPS do GIF'),
      loop: gif.loop == null ? true : Boolean(gif.loop),
      quality: choice(gif.quality, 'balanced', qualities, 'Qualidade do GIF')
    }
  };
}
