export type EditorOperation = 'cut' | 'merge' | 'side-by-side' | 'frame' | 'gif';
export type EditorTab = 'cut' | 'merge' | 'side-by-side' | 'crop' | 'frame' | 'gif' | 'adjustments';
export type FitMode = 'contain' | 'cover';
export type OutputAspect = '16:9' | '9:16' | '1:1' | '4:5';
export type DurationPolicy = 'shortest' | 'longest';
export type AudioPolicy = 'first' | 'second' | 'mix' | 'none';
export type Quality = 'high' | 'balanced' | 'compact';
export type FrameFormat = 'png' | 'jpg' | 'webp';

export type CropRect = { x: number; y: number; width: number; height: number };
export type ExportInput = { assetId: string; start: number; end: number };
export type Adjustments = {
  crop: CropRect;
  rotation: 0 | 90 | 180 | 270;
  flipHorizontal: boolean;
  flipVertical: boolean;
  speed: number;
  muted: boolean;
  volume: number;
};
export type OutputSettings = { height: 0 | 720 | 1080 | 1440 | 2160; fps: 0 | 24 | 25 | 30 | 60; quality: Quality };
export type SideBySideSettings = {
  aspect: OutputAspect;
  divider: number;
  leftFit: FitMode;
  rightFit: FitMode;
  leftPanX: number;
  leftPanY: number;
  rightPanX: number;
  rightPanY: number;
  durationPolicy: DurationPolicy;
  audio: AudioPolicy;
};
export type FrameSettings = { time: number; format: FrameFormat; height: OutputSettings['height'] };
export type GifSettings = { width: number; fps: number; loop: boolean; quality: Quality };

export type ExportRequest = {
  projectId: string;
  operation: EditorOperation | string;
  inputs: Array<Partial<ExportInput> & Pick<ExportInput, 'assetId'>>;
  adjustments?: Partial<Adjustments> & { crop?: Partial<CropRect> };
  output?: Partial<OutputSettings>;
  sideBySide?: Partial<SideBySideSettings>;
  frame?: Partial<FrameSettings>;
  gif?: Partial<GifSettings>;
};

export type NormalizedExport = {
  projectId: string;
  operation: EditorOperation;
  inputs: ExportInput[];
  adjustments: Adjustments;
  output: OutputSettings;
  sideBySide: SideBySideSettings;
  frame: FrameSettings;
  gif: GifSettings;
};
