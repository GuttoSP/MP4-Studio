import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';

describe('App shell', () => {
  it('identifies the product and offers project creation', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Editor MP4' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Novo projeto' })).toBeEnabled();
  });
});
