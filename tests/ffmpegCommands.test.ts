// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { buildRenderCommand, outputDescriptor } from '../server/ffmpegCommands';
import { normalizeExport } from '../shared/editorValidation';
import type { EditorAsset } from '../shared/types';

const asset: EditorAsset & { path: string } = {
  id: '11111111-1111-4111-8111-111111111111', projectId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'clip.mp4', kind: 'video', duration: 10, width: 1280, height: 720, fps: 30,
  hasAudio: true, sortOrder: 0, path: 'D:\\safe\\clip.mp4'
};
const second: EditorAsset & { path: string } = {
  ...asset,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'second.mp4',
  duration: 6,
  width: 720,
  height: 720,
  path: 'D:\\safe\\second.mp4'
};

describe('buildRenderCommand', () => {
  it('builds exact ordered multi-range trim with no shell', () => {
    const project = normalizeExport({
      projectId: asset.projectId,
      operation: 'cut',
      inputs: [
        { assetId: asset.id, start: 3, end: 4 },
        { assetId: asset.id, start: 0, end: 2 }
      ]
    }, [asset]);

    const command = buildRenderCommand(project, [asset], 'D:\\safe\\output.mp4');
    const graph = command.args[command.args.indexOf('-filter_complex') + 1];

    expect(command.shell).toBe(false);
    expect(graph).toContain('trim=start=3:end=4');
    expect(graph).toContain('trim=start=0:end=2');
    expect(graph).toContain('concat=n=2:v=1:a=1');
    expect(command.args).toContain('+faststart');
  });

  it('selects the right output descriptor for frame and GIF', () => {
    const base = { projectId: asset.projectId, inputs: [{ assetId: asset.id, start: 0, end: 2 }] };
    expect(outputDescriptor(normalizeExport({ ...base, operation: 'gif' }, [asset])).extension).toBe('.gif');
    expect(outputDescriptor(normalizeExport({ ...base, operation: 'frame', frame: { format: 'webp' } }, [asset])).extension).toBe('.webp');
  });

  it('freezes the shorter pane and mixes both audio streams under the longest policy', () => {
    const project = normalizeExport({
      projectId: asset.projectId,
      operation: 'side-by-side',
      inputs: [
        { assetId: asset.id, start: 0, end: 9 },
        { assetId: second.id, start: 0, end: 3 }
      ],
      sideBySide: { durationPolicy: 'longest', audio: 'mix', rightFit: 'cover', rightPanX: 0.75 }
    }, [asset, second]);

    const command = buildRenderCommand(project, [asset, second], 'D:\\safe\\side.mp4');
    const graph = command.args[command.args.indexOf('-filter_complex') + 1];

    expect(graph).toContain('tpad=stop_mode=clone:stop_duration=6');
    expect(graph).toContain('amix=inputs=2:duration=longest:normalize=1');
    expect(graph).toContain('(iw-ow)*0.75');
  });
});
