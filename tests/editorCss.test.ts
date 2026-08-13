import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('desktop multilayer workspace layout', () => {
  it('reserves enough height to show three tracks and the resolved output', () => {
    const css = readFileSync(resolve('src/styles/editor.css'), 'utf8')
      .replace(/\s+/g, ' ');

    expect(css).toContain(
      '@media (min-width: 901px) { .center-workspace:has(.layered-timeline) { grid-template-rows: minmax(260px, 1fr) minmax(354px, .8fr); } }',
    );
  });
});
