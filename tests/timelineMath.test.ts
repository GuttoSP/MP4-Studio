import { describe, expect, it } from 'vitest';
import { clampTime, snapTime, timeFromPointer } from '../src/components/timeline/timelineMath';

describe('timeline math', () => {
  it('converts pointer positions to clamped timeline time', () => {
    expect(timeFromPointer(350, 100, 500, 20)).toBe(10);
    expect(timeFromPointer(0, 100, 500, 20)).toBe(0);
    expect(timeFromPointer(900, 100, 500, 20)).toBe(20);
    expect(timeFromPointer(200, 100, 0, 20)).toBe(0);
  });

  it('snaps to video frames and respects duration limits', () => {
    expect(snapTime(1.02, 25, 10)).toBe(1.04);
    expect(snapTime(12, 25, 10)).toBe(10);
    expect(snapTime(1.027, 0, 10)).toBe(1.03);
    expect(clampTime(Number.NaN, 10)).toBe(0);
  });
});
