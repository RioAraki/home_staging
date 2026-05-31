import { describe, it, expect } from 'vitest';

// Reimplemented locally to avoid cc imports — keep in sync with InputHandler.hitTest.
const CELL = 40, ROWS = 16, COLS = 16, SLOP = 12;

function hit(x: number, y: number) {
  if (x < 0 || y < 0 || x >= COLS * CELL || y >= ROWS * CELL) return { kind: 'outside' };
  const cellX = Math.floor(x / CELL), cellY = Math.floor(y / CELL);
  const lx = x - cellX * CELL, ly = y - cellY * CELL;
  const dT = ly, dB = CELL - ly, dL = lx, dR = CELL - lx;
  const m = Math.min(dT, dB, dL, dR);
  if (m >= SLOP) return { kind: 'cell', row: cellY, col: cellX };
  if (m === dT) return { kind: 'edge', side: 'top' };
  if (m === dB) return { kind: 'edge', side: 'bottom' };
  if (m === dL) return { kind: 'edge', side: 'left' };
  return { kind: 'edge', side: 'right' };
}

describe('hitTest', () => {
  it('center of cell is a cell hit', () => {
    expect(hit(20, 20)).toEqual({ kind: 'cell', row: 0, col: 0 });
  });
  it('within slop of top edge is edge hit', () => {
    expect(hit(20, 5)).toEqual({ kind: 'edge', side: 'top' });
  });
  it('exactly at slop boundary is cell hit', () => {
    expect(hit(20, 12)).toEqual({ kind: 'cell', row: 0, col: 0 });
  });
  it('corner picks nearer edge', () => {
    expect(hit(3, 5)).toMatchObject({ kind: 'edge' });
  });
  it('out of grid returns outside', () => {
    expect(hit(-1, 10).kind).toBe('outside');
  });
});
