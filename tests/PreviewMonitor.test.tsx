import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorAsset } from '../shared/types';
import { PreviewMonitor } from '../src/components/PreviewMonitor';
import { createInitialEditorHistory } from '../src/editor/editorState';

const portraitAsset: EditorAsset = {
  id: 'portrait-video',
  projectId: 'project',
  name: 'retrato.mp4',
  kind: 'video',
  duration: 8,
  width: 540,
  height: 960,
  fps: 24,
  hasAudio: true,
  sortOrder: 0
};

afterEach(cleanup);

describe('PreviewMonitor', () => {
  it('contains a portrait video inside the monitor without changing its aspect', () => {
    const state = createInitialEditorHistory('project', [portraitAsset]).present;
    render(<PreviewMonitor state={state} selected={portraitAsset} onTime={vi.fn()} />);

    const preview = screen.getByLabelText('Monitor de vídeo').querySelector('video.main-media');
    expect(preview).toHaveStyle({
      width: '100%',
      height: '100%',
      minWidth: '0',
      minHeight: '0',
      objectFit: 'contain'
    });
  });
});
