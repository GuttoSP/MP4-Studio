import { describe, expect, it } from 'vitest';
import { normalizeExport } from '../shared/editorValidation';
import type { EditorAsset } from '../shared/types';

const video = (id: string, overrides: Partial<EditorAsset> = {}): EditorAsset => ({
  id,
  projectId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: `${id}.mp4`, kind: 'video', duration: 10, width: 1280, height: 720,
  fps: 30, hasAudio: true, sortOrder: 0, ...overrides
});

const base = {
  projectId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  operation: 'cut',
  inputs: [{ assetId: '11111111-1111-4111-8111-111111111111', start: 1, end: 4 }]
};

describe('normalizeExport', () => {
  it('normalizes safe defaults for an exact cut', () => {
    const result = normalizeExport(base, [video(base.inputs[0].assetId)]);
    expect(result).toMatchObject({
      operation: 'cut',
      output: { height: 0, fps: 0, quality: 'balanced' },
      adjustments: { speed: 1, muted: false, volume: 1 }
    });
  });

  it('rejects reversed or out-of-duration ranges', () => {
    expect(() => normalizeExport({ ...base, inputs: [{ ...base.inputs[0], start: 8, end: 3 }] }, [video(base.inputs[0].assetId)]))
      .toThrow('Trecho inválido');
  });

  it('requires two distinct assets for side-by-side', () => {
    expect(() => normalizeExport({ ...base, operation: 'side-by-side', inputs: [base.inputs[0], base.inputs[0]] }, [video(base.inputs[0].assetId)]))
      .toThrow('duas mídias diferentes');
  });

  it('rejects crop coordinates that escape the frame', () => {
    expect(() => normalizeExport({ ...base, adjustments: { crop: { x: 0.8, y: 0, width: 0.4, height: 1 } } }, [video(base.inputs[0].assetId)]))
      .toThrow('ultrapassa');
  });
});
