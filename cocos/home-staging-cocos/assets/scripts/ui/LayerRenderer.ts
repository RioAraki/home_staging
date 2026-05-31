import { Graphics, Color } from 'cc';
import type { Scenario, CellAttrs } from '../core/types';

export const CELL_SIZE = 40;
export const GRID_ROWS = 16;
export const GRID_COLS = 16;

export function drawGridBg(g: Graphics, scenario: Scenario) {
  g.clear();

  const ascii = scenario.grid.ascii.replace(/\n+$/, '').split('\n');
  const legend = scenario.grid.legend;

  // Fill cells by terrain.
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const ch = ascii[r]?.[c] ?? '.';
      const attrs: CellAttrs | undefined = legend[ch];
      const color = fillColorFor(attrs?.terrain);
      g.fillColor = color;
      // Cocos UI: y axis points UP, so we flip rows.
      const x = c * CELL_SIZE - (GRID_COLS * CELL_SIZE) / 2;
      const y = -(r * CELL_SIZE) + (GRID_ROWS * CELL_SIZE) / 2 - CELL_SIZE;
      g.rect(x, y, CELL_SIZE, CELL_SIZE);
      g.fill();
    }
  }

  // Grid lines.
  g.strokeColor = new Color(120, 120, 120, 80);
  g.lineWidth = 1;
  const W = GRID_COLS * CELL_SIZE;
  const H = GRID_ROWS * CELL_SIZE;
  for (let i = 0; i <= GRID_COLS; i++) {
    const x = i * CELL_SIZE - W / 2;
    g.moveTo(x, -H / 2);
    g.lineTo(x, H / 2);
  }
  for (let i = 0; i <= GRID_ROWS; i++) {
    const y = i * CELL_SIZE - H / 2;
    g.moveTo(-W / 2, y);
    g.lineTo(W / 2, y);
  }
  g.stroke();
}

function fillColorFor(terrain?: string): Color {
  switch (terrain) {
    case 'indoor':   return new Color(245, 240, 225, 255);
    case 'outdoor':  return new Color(160, 200, 160, 255);
    case 'water':    return new Color(150, 180, 220, 255);
    case 'road':     return new Color(180, 180, 180, 255);
    case 'obstacle': return new Color(100, 100, 100, 255);
    default:         return new Color(255, 255, 255, 0);
  }
}

import type { RoomSlot } from '../core/types';

export function drawWalls(g: Graphics, walls: Record<string, true>) {
  g.clear();
  g.strokeColor = new Color(50, 50, 50, 255);
  g.lineWidth = 4;
  const W = GRID_COLS * CELL_SIZE, H = GRID_ROWS * CELL_SIZE;
  for (const key of Object.keys(walls)) {
    const [type, rs, cs] = key.split(':');
    const r = parseInt(rs, 10), c = parseInt(cs, 10);
    if (type === 'h') {
      g.moveTo(c * CELL_SIZE - W / 2, H / 2 - r * CELL_SIZE);
      g.lineTo((c + 1) * CELL_SIZE - W / 2, H / 2 - r * CELL_SIZE);
    } else {
      g.moveTo(c * CELL_SIZE - W / 2, H / 2 - r * CELL_SIZE);
      g.lineTo(c * CELL_SIZE - W / 2, H / 2 - (r + 1) * CELL_SIZE);
    }
  }
  g.stroke();
}

export function drawDoors(g: Graphics, doors: Record<string, RoomSlot>) {
  g.clear();
  g.strokeColor = new Color(180, 90, 30, 255);
  g.lineWidth = 3;
  const W = GRID_COLS * CELL_SIZE, H = GRID_ROWS * CELL_SIZE;
  for (const key of Object.keys(doors)) {
    const [type, rs, cs] = key.split(':');
    const r = parseInt(rs, 10), c = parseInt(cs, 10);
    if (type === 'h') {
      const x = c * CELL_SIZE + CELL_SIZE / 2 - W / 2;
      const y = H / 2 - r * CELL_SIZE;
      g.circle(x, y, CELL_SIZE * 0.4);
    } else {
      const x = c * CELL_SIZE - W / 2;
      const y = H / 2 - r * CELL_SIZE - CELL_SIZE / 2;
      g.circle(x, y, CELL_SIZE * 0.4);
    }
  }
  g.stroke();
}

export function drawWindows(g: Graphics, windows: Record<string, true>) {
  g.clear();
  g.strokeColor = new Color(80, 140, 200, 255);
  g.lineWidth = 4;
  const W = GRID_COLS * CELL_SIZE, H = GRID_ROWS * CELL_SIZE;
  for (const key of Object.keys(windows)) {
    const [type, rs, cs] = key.split(':');
    const r = parseInt(rs, 10), c = parseInt(cs, 10);
    if (type === 'h') {
      const x1 = c * CELL_SIZE - W / 2;
      const x2 = (c + 1) * CELL_SIZE - W / 2;
      const y = H / 2 - r * CELL_SIZE;
      g.moveTo(x1, y); g.lineTo(x2, y);
    } else {
      const x = c * CELL_SIZE - W / 2;
      const y1 = H / 2 - r * CELL_SIZE;
      const y2 = H / 2 - (r + 1) * CELL_SIZE;
      g.moveTo(x, y1); g.lineTo(x, y2);
    }
  }
  g.stroke();
}
