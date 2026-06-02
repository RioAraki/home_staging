import { _decorator, Component, Node, Graphics, Color } from 'cc';
import { gameStore } from '../state/gameStore';
import { cardByNumberVariant } from '../core/dataLoader';
import { transformOption } from '../core/geometry';
import { layout, edgeX, edgeY, FULL_GRID_ROWS, FULL_GRID_COLS } from './viewport';
const { ccclass, property } = _decorator;

const COL_GHOST_FILL   = new Color(255, 225, 105, 90);
const COL_GHOST_STROKE = new Color(255, 225, 105, 255);

@ccclass('GhostPiece')
export class GhostPiece extends Component {
  @property(Node) sprite!: Node;

  private unsub?: () => void;
  /** Origin in grid coords [row, col] of the top-left of the bbox. */
  private origin: [number, number] = [8, 8];

  start() {
    // Legacy sprite ghost is replaced by Graphics drawing — hide it.
    if (this.sprite) this.sprite.active = false;
    this.refresh();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.selectedOption !== prev.selectedOption) this.refresh();
      if (s.lastError !== prev.lastError && s.lastError) this.flashRed();
    });
  }

  onDestroy() { this.unsub?.(); }

  setOrigin(r: number, c: number) {
    this.origin = [
      Math.max(0, Math.min(FULL_GRID_ROWS - 1, r)),
      Math.max(0, Math.min(FULL_GRID_COLS - 1, c)),
    ];
    this.draw();
  }

  getOrigin(): [number, number] { return this.origin; }

  private graphics(): Graphics {
    return this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
  }

  private flashRed() {
    const g = this.graphics();
    // Brief red overlay over the current ghost footprint.
    const s = gameStore.getState();
    const sel = s.selectedOption;
    if (!sel) return;
    const card = cardByNumberVariant(sel.number, sel.variant);
    const opt = card?.options.find(o => o.option_index === sel.optionIndex);
    if (!opt) return;
    const t = transformOption(opt, sel.rotation, sel.mirrored);
    const cell = layout().cell;
    g.clear();
    g.fillColor = new Color(255, 100, 100, 120);
    for (const [r, c] of t.shape) {
      const ar = this.origin[0] + r, ac = this.origin[1] + c;
      g.rect(edgeX(ac), edgeY(ar) - cell, cell, cell);
      g.fill();
    }
    this.scheduleOnce(() => { this.draw(); }, 0.2);
  }

  private refresh() {
    const s = gameStore.getState();
    const sel = s.selectedOption;
    if (!sel) { if (this.node) this.node.active = false; return; }
    this.node.active = true;
    this.draw();
  }

  /** Draw yellow occupied cells + yellow open-space dots for the selection. */
  private draw() {
    const s = gameStore.getState();
    const sel = s.selectedOption;
    const g = this.graphics();
    g.clear();
    if (!sel) return;

    const card = cardByNumberVariant(sel.number, sel.variant);
    const opt = card?.options.find(o => o.option_index === sel.optionIndex);
    if (!opt) return;

    const t = transformOption(opt, sel.rotation, sel.mirrored);
    const cell = layout().cell;
    const [or, oc] = this.origin;

    // Occupied cells: translucent yellow fill + yellow border.
    g.fillColor = COL_GHOST_FILL;
    g.strokeColor = COL_GHOST_STROKE;
    g.lineWidth = 2;
    for (const [r, c] of t.shape) {
      const x = edgeX(oc + c);
      const y = edgeY(or + r) - cell;
      g.rect(x, y, cell, cell);
      g.fill();
      g.rect(x, y, cell, cell);
      g.stroke();
    }

    // Open-space cells: filled yellow dot at the cell centre.
    const radius = Math.max(2, cell * 0.09);
    g.fillColor = COL_GHOST_STROKE;
    for (const [r, c] of t.open_spaces) {
      const cx = edgeX(oc + c) + cell / 2;
      const cy = edgeY(or + r) - cell / 2;
      g.circle(cx, cy, radius);
      g.fill();
    }
  }
}
