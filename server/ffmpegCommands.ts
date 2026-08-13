import type { NormalizedExport, Quality } from '../shared/editorTypes';
import type { EditorAsset } from '../shared/types';

export type ResolvedAsset = EditorAsset & { path: string };
export type OutputDescriptor = { extension: '.mp4' | '.gif' | '.png' | '.jpg' | '.webp'; contentType: string; fileName: string };
export type RenderCommand = { executable: string; args: string[]; outputPath: string; duration: number; shell: false };

const crf: Record<Quality, number> = { high: 18, balanced: 23, compact: 28 };
const number = (value: number) => Number(value.toFixed(6)).toString();
const even = (value: number) => Math.max(2, Math.floor(value / 2) * 2);

export function outputDescriptor(project: NormalizedExport): OutputDescriptor {
  if (project.operation === 'gif') return { extension: '.gif', contentType: 'image/gif', fileName: 'animacao.gif' };
  if (project.operation === 'frame') {
    if (project.frame.format === 'jpg') return { extension: '.jpg', contentType: 'image/jpeg', fileName: 'frame.jpg' };
    if (project.frame.format === 'webp') return { extension: '.webp', contentType: 'image/webp', fileName: 'frame.webp' };
    return { extension: '.png', contentType: 'image/png', fileName: 'frame.png' };
  }
  return { extension: '.mp4', contentType: 'video/mp4', fileName: 'video-editado.mp4' };
}

function videoFilters(project: NormalizedExport, asset: EditorAsset): string[] {
  const filters: string[] = [];
  const crop = project.adjustments.crop;
  if (crop.x || crop.y || crop.width !== 1 || crop.height !== 1) {
    const width = even(crop.width * asset.width);
    const height = even(crop.height * asset.height);
    const x = Math.max(0, even(crop.x * asset.width));
    const y = Math.max(0, even(crop.y * asset.height));
    filters.push(`crop=${width}:${height}:${x}:${y}`);
  }
  if (project.adjustments.rotation === 90) filters.push('transpose=clock');
  if (project.adjustments.rotation === 180) filters.push('hflip', 'vflip');
  if (project.adjustments.rotation === 270) filters.push('transpose=cclock');
  if (project.adjustments.flipHorizontal) filters.push('hflip');
  if (project.adjustments.flipVertical) filters.push('vflip');
  if (project.adjustments.speed !== 1) filters.push(`setpts=PTS/${number(project.adjustments.speed)}`);
  if (project.output.height) filters.push(`scale=-2:${project.output.height}:flags=lanczos`);
  else filters.push('scale=trunc(iw/2)*2:trunc(ih/2)*2');
  if (project.output.fps) filters.push(`fps=${project.output.fps}`);
  filters.push('format=yuv420p');
  return filters;
}

function audioFilters(project: NormalizedExport): string[] {
  const result: string[] = [];
  if (project.adjustments.speed !== 1) result.push(`atempo=${number(project.adjustments.speed)}`);
  if (project.adjustments.volume !== 1) result.push(`volume=${number(project.adjustments.volume)}`);
  return result;
}

function mp4Tail(args: string[], project: NormalizedExport, hasAudio: boolean, outputPath: string) {
  args.push('-map', '[outv]');
  if (hasAudio) args.push('-map', '[outa]');
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf[project.output.quality]), '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
  if (hasAudio) args.push('-c:a', 'aac', '-b:a', '192k');
  args.push('-progress', 'pipe:2', '-nostats', outputPath);
}

function cutOrMerge(project: NormalizedExport, assets: ResolvedAsset[], outputPath: string): RenderCommand {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const unique = [...new Map(project.inputs.map((input) => [input.assetId, byId.get(input.assetId)!])).values()];
  const index = new Map(unique.map((asset, item) => [asset.id, item]));
  const args = ['-y', ...unique.flatMap((asset) => ['-i', asset.path])];
  const target = byId.get(project.inputs[0].assetId)!;
  const hasAudio = !project.adjustments.muted && project.inputs.some((input) => byId.get(input.assetId)?.hasAudio);
  const graph: string[] = [];
  const videoLabels: string[] = [];
  const audioLabels: string[] = [];
  project.inputs.forEach((input, item) => {
    const asset = byId.get(input.assetId)!;
    const base = [`trim=start=${number(input.start)}:end=${number(input.end)}`, 'setpts=PTS-STARTPTS'];
    if (project.operation === 'merge' || project.operation === 'timeline') {
      base.push(
        `scale=${even(target.width)}:${even(target.height)}:force_original_aspect_ratio=decrease`,
        `pad=${even(target.width)}:${even(target.height)}:(ow-iw)/2:(oh-ih)/2`,
        `fps=${project.output.fps || target.fps || 30}`,
        'setsar=1',
        'settb=AVTB'
      );
    }
    graph.push(`[${index.get(asset.id)}:v]${base.join(',')}[v${item}]`); videoLabels.push(`[v${item}]`);
    if (hasAudio) {
      const duration = input.end - input.start;
      graph.push(asset.hasAudio
        ? `[${index.get(asset.id)}:a]atrim=start=${number(input.start)}:end=${number(input.end)},asetpts=PTS-STARTPTS,aresample=48000[a${item}]`
        : `anullsrc=r=48000:cl=stereo,atrim=duration=${number(duration)},asetpts=PTS-STARTPTS[a${item}]`);
      audioLabels.push(`[a${item}]`);
    }
  });
  const dissolve = project.operation === 'timeline' && project.transition.type === 'dissolve' && project.inputs.length > 1;
  if (dissolve) {
    const duration = project.transition.duration;
    let cumulative = project.inputs[0].end - project.inputs[0].start;
    let currentVideo = 'v0';
    let currentAudio = 'a0';
    for (let item = 1; item < project.inputs.length; item += 1) {
      const offset = cumulative - duration * item;
      const videoOutput = item === project.inputs.length - 1 ? 'basev' : `xv${item}`;
      graph.push(`[${currentVideo}][v${item}]xfade=transition=fade:duration=${number(duration)}:offset=${number(offset)}[${videoOutput}]`);
      currentVideo = videoOutput;
      if (hasAudio) {
        const audioOutput = item === project.inputs.length - 1 ? 'basea' : `xa${item}`;
        graph.push(`[${currentAudio}][a${item}]acrossfade=d=${number(duration)}:c1=tri:c2=tri[${audioOutput}]`);
        currentAudio = audioOutput;
      }
      cumulative += project.inputs[item].end - project.inputs[item].start;
    }
  } else if (project.inputs.length > 1) {
    const labels = project.inputs.map((_, item) => `${videoLabels[item]}${hasAudio ? audioLabels[item] : ''}`).join('');
    graph.push(`${labels}concat=n=${project.inputs.length}:v=1:a=${hasAudio ? 1 : 0}[basev]${hasAudio ? '[basea]' : ''}`);
  } else { graph.push('[v0]null[basev]'); if (hasAudio) graph.push('[a0]anull[basea]'); }
  graph.push(`[basev]${videoFilters(project, target).join(',')}[outv]`);
  if (hasAudio) graph.push(`[basea]${audioFilters(project).join(',') || 'anull'}[outa]`);
  args.push('-filter_complex', graph.join(';'));
  mp4Tail(args, project, hasAudio, outputPath);
  const overlap = dissolve ? project.transition.duration * (project.inputs.length - 1) : 0;
  return { executable: 'ffmpeg', args, outputPath, duration: (project.inputs.reduce((sum, input) => sum + input.end - input.start, 0) - overlap) / project.adjustments.speed, shell: false };
}

function sideBySide(project: NormalizedExport, assets: ResolvedAsset[], outputPath: string): RenderCommand {
  const selected = project.inputs.map((input) => assets.find((asset) => asset.id === input.assetId)!);
  const ratios = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5 };
  const height = project.output.height || 720;
  const width = even(height * ratios[project.sideBySide.aspect]);
  const leftWidth = even(width * project.sideBySide.divider);
  const rightWidth = even(width - leftWidth);
  const durations = project.inputs.map((input, i) => selected[i].kind === 'image' ? Number.POSITIVE_INFINITY : input.end - input.start);
  const finiteDurations = durations.filter(Number.isFinite);
  const duration = project.sideBySide.durationPolicy === 'longest' ? Math.max(...finiteDurations) : Math.min(...finiteDurations);
  const args = ['-y', ...selected.flatMap((asset) => asset.kind === 'image' ? ['-loop', '1', '-i', asset.path] : ['-i', asset.path])];
  const graph: string[] = [];
  selected.forEach((asset, i) => {
    const pane = i ? rightWidth : leftWidth;
    const fit = i ? project.sideBySide.rightFit : project.sideBySide.leftFit;
    const panX = i ? project.sideBySide.rightPanX : project.sideBySide.leftPanX;
    const panY = i ? project.sideBySide.rightPanY : project.sideBySide.leftPanY;
    const source = project.inputs[i];
    const filters = asset.kind === 'image' ? [`trim=duration=${number(duration)}`] : [`trim=start=${number(source.start)}:end=${number(source.end)}`];
    filters.push('setpts=PTS-STARTPTS');
    const sourceDuration = asset.kind === 'image' ? duration : source.end - source.start;
    if (sourceDuration < duration) filters.push(`tpad=stop_mode=clone:stop_duration=${number(duration - sourceDuration)}`);
    filters.push(`trim=duration=${number(duration)}`, `fps=${project.output.fps || 30}`);
    filters.push(fit === 'cover'
      ? `scale=${pane}:${height}:force_original_aspect_ratio=increase,crop=${pane}:${height}:(iw-ow)*${number(panX)}:(ih-oh)*${number(panY)}`
      : `scale=${pane}:${height}:force_original_aspect_ratio=decrease,pad=${pane}:${height}:(ow-iw)*${number(panX)}:(oh-ih)*${number(panY)}`);
    graph.push(`[${i}:v]${filters.join(',')}[v${i}]`);
  });
  graph.push('[v0][v1]hstack=inputs=2[outv]');
  let audioIndexes: number[] = [];
  if (!project.adjustments.muted && project.sideBySide.audio === 'first' && selected[0].hasAudio) audioIndexes = [0];
  if (!project.adjustments.muted && project.sideBySide.audio === 'second' && selected[1].hasAudio) audioIndexes = [1];
  if (!project.adjustments.muted && project.sideBySide.audio === 'mix') audioIndexes = selected.flatMap((asset, i) => asset.hasAudio ? [i] : []);
  for (const index of audioIndexes) {
    const input = project.inputs[index];
    graph.push(`[${index}:a]atrim=start=${number(input.start)}:end=${number(input.end)},asetpts=PTS-STARTPTS,apad,atrim=duration=${number(duration)},aresample=48000[a${index}]`);
  }
  if (audioIndexes.length === 1) graph.push(`[a${audioIndexes[0]}]anull[abase]`);
  if (audioIndexes.length > 1) graph.push(`${audioIndexes.map((index) => `[a${index}]`).join('')}amix=inputs=${audioIndexes.length}:duration=longest:normalize=1[abase]`);
  if (audioIndexes.length) graph.push(`[abase]${audioFilters(project).join(',') || 'anull'}[outa]`);
  args.push('-filter_complex', graph.join(';'));
  mp4Tail(args, project, audioIndexes.length > 0, outputPath);
  return { executable: 'ffmpeg', args, outputPath, duration, shell: false };
}

export function buildRenderCommand(project: NormalizedExport, assets: ResolvedAsset[], outputPath: string): RenderCommand {
  const primary = assets.find((asset) => asset.id === project.inputs[0].assetId);
  if (!primary) throw new Error('Mídia principal não encontrada.');
  if (project.operation === 'side-by-side') return sideBySide(project, assets, outputPath);
  if (project.operation === 'frame') {
    const frameProject = { ...project, output: { ...project.output, height: project.frame.height } };
    const filters = videoFilters(frameProject, primary).filter((filter) => !filter.startsWith('format='));
    const args = ['-y', '-ss', number(project.frame.time), '-i', primary.path, '-frames:v', '1'];
    if (filters.length) args.push('-vf', filters.join(','));
    args.push('-progress', 'pipe:2', '-nostats', outputPath);
    return { executable: 'ffmpeg', args, outputPath, duration: 1, shell: false };
  }
  if (project.operation === 'gif') {
    const input = project.inputs[0];
    const graph = `[0:v]trim=start=${number(input.start)}:end=${number(input.end)},setpts=PTS-STARTPTS,fps=${project.gif.fps},scale=${project.gif.width}:-2:flags=lanczos,split[a][b];[b]palettegen[p];[a][p]paletteuse[outv]`;
    return { executable: 'ffmpeg', args: ['-y', '-i', primary.path, '-filter_complex', graph, '-map', '[outv]', '-loop', project.gif.loop ? '0' : '-1', '-progress', 'pipe:2', '-nostats', outputPath], outputPath, duration: input.end - input.start, shell: false };
  }
  return cutOrMerge(project, assets, outputPath);
}
