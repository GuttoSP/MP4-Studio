import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CropManipulator } from '../src/components/CropManipulator';

afterEach(cleanup);

describe('CropManipulator', () => {
  it('moves the crop visually and commits only at pointer release', () => {
    const onCommit = vi.fn();
    render(<CropManipulator crop={{ x: .1, y: .1, width: .5, height: .5 }} onCommit={onCommit} />);
    const overlay = screen.getByTestId('crop-overlay');
    vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 50, width: 400, height: 200 } as DOMRect);
    const mover = screen.getByRole('button', { name: 'Mover área de crop' });

    fireEvent.pointerDown(mover, { pointerId: 4, clientX: 140, clientY: 70 });
    fireEvent.pointerMove(mover, { pointerId: 4, clientX: 220, clientY: 110 });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(mover, { pointerId: 4, clientX: 220, clientY: 110 });
    expect(onCommit).toHaveBeenCalledWith({ x: .3, y: .3, width: .5, height: .5 });
  });

  it('exposes eight resize handles', () => {
    render(<CropManipulator crop={{ x: 0, y: 0, width: 1, height: 1 }} onCommit={vi.fn()} />);
    expect(screen.getAllByRole('slider')).toHaveLength(8);
  });
});
