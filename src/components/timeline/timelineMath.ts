export function clampTime(time: number, duration: number): number {
  if (!Number.isFinite(time)) return 0;
  return Math.min(Math.max(0, duration), Math.max(0, time));
}

export function timeFromPointer(
  clientX: number,
  trackLeft: number,
  trackWidth: number,
  duration: number
): number {
  if (trackWidth <= 0) return 0;
  return clampTime((clientX - trackLeft) / trackWidth * duration, duration);
}

export function snapTime(time: number, fps: number, duration: number): number {
  const step = fps > 0 ? 1 / fps : 0.01;
  return Number(clampTime(Math.round(time / step) * step, duration).toFixed(3));
}
