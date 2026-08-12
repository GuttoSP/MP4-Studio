// @vitest-environment node

import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveInside } from '../server/pathSafety';

describe('resolveInside', () => {
  const root = resolve('D:/projetos/editor_mp4/data');

  it('resolves a controlled descendant', () => {
    expect(resolveInside(root, 'projects', 'abc', 'clip.mp4'))
      .toBe(resolve(root, 'projects', 'abc', 'clip.mp4'));
  });

  it('rejects parent traversal', () => {
    expect(() => resolveInside(root, '..', 'escape.mp4')).toThrow('fora da área controlada');
  });

  it('rejects an absolute segment', () => {
    expect(() => resolveInside(root, 'C:\\Windows\\system.ini')).toThrow('fora da área controlada');
  });
});
