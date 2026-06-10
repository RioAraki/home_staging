import { _decorator, Component, Node, Graphics, Color } from 'cc';
import { gameStore } from '../state/gameStore';
import { cardByNumberVariant } from '../core/dataLoader';
import { transformOption } from '../core/geometry';
import { validatePlacement } from '../core/validation';
import { layout, edgeX, edgeY, FULL_GRID_ROWS, FULL_GRID_COLS } from './viewport';
const { ccclass, property } = _decorator;

const COL_OK_FILL    = new Color(255, 225, 105, 90);
const COL_OK_STROKE  = new Color(255, 225, 105, 255);
const COL_BAD_FILL   = new Color(255, 90, 90, 100);
const COL_BAD_STROKE = new Color(255, 70, 70, 255);

@ccclass('GhostPiece')
export class GhostPiece extends Component {
  @property(Node) sprite!: Node;

  private unsub?: () => void;
  /** Origin in grid coords [row, col] of the top-left of the bbox. */
  private origin: [number, number] = [8, 8];
  /** The ghost is hidden until the player drags it onto the plan (so picking
   *  an option in the tray no longer auto-hovers a piece on the floor plan). */
  private positioned = false;

  start() {
    // Legacy sprite ghost is replaced by Graphics drawing — hide it.
    if (this.sprite) this.sprite.active = false;
    this.refresh();
    this.unsub = gameStore.subscribe((s, prev) => {
      const sel = s.selectedOption, prevSel = prev.selectedOption;
      // A *different* piece (not just a rotation/mirror of the same one) resets
      // the positioned state, so the new piece must be dragged onto the plan.
      const pieceChanged = (!!sel !== !!prevSel) ||
        (!!sel && !!prevSel &&
          (sel.slot !== prevSel.slot || sel.slotIdx !== prevSel.slotIdx ||
           sel.optionIndex !== prevSel.optionIndex));
      if (pieceChanged) this.positioned = false;
      if (sel !== prevSel) this.refresh();
    });
  }

  onDestroy() { this.unsub?.(); }

  setOrigin(r: number, c: number) {
    this.origin = [
      Math.max(0, Math.min(FULL_GRID_ROWS - 1, r)),
      Math.max(0, Math.min(FULL_GRID_COLS - 1, c)),
    ];
    this.positioned = true;
    if (this.node) this.node.active = true;
    this.draw();
  }

  getOrigin(): [number, number] { return this.origin; }
  isPositioned(): boolean { return this.positioned; }

  private graphics(): Graphics {
    return this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
  }

  private refresh() {
    const sel = gameStore.getState().selectedOption;
    if (!sel || !this.positioned) {
      this.graphics().clear();
      if (this.node) this.node.active = false;
      return;
    }
    this.node.active = true;
    this.draw();
  }

  /** Draw the footprint preview: yellow when the placement is valid, red when
   *  it's blocked (wall / overlap / off-plan). */
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

    const valid = !!s.scenario && validatePlacement(
      s.scenario, t, this.origin, s.placedPieces, sel.number, s.doors, s.frontDoorEdge, s.walls,
    ).valid;
    const fillCol   = valid ? COL_OK_FILL   : COL_BAD_FILL;
    const strokeCol = valid ? COL_OK_STROKE : COL_BAD_STROKE;

    // Occupied cells: translucent fill + border.
    g.fillColor = fillCol;
    g.strokeColor = strokeCol;
    g.lineWidth = 2;
    for (const [r, c] of t.shape) {
      const x = edgeX(oc + c);
      const y = edgeY(or + r) - cell;
      g.rect(x, y, cell, cell);
      g.fill();
      g.rect(x, y, cell, cell);
      g.stroke();
    }

    // Open-space cells: a dot at the cell centre.
    const radius = Math.max(2, cell * 0.09);
    g.fillColor = strokeCol;
    for (const [r, c] of t.open_spaces) {
      const cx = edgeX(oc + c) + cell / 2;
      const cy = edgeY(or + r) - cell / 2;
      g.circle(cx, cy, radius);
      g.fill();
    }

    // Highlight existing open-space cells that the ghost's shape would block.
    // Build the set of world cells the ghost shape occupies.
    const ghostShapeCells = new Set<string>();
    for (const [r, c] of t.shape) ghostShapeCells.add(`${or + r},${oc + c}`);

    // For each placed piece, find open_spaces that intersect with ghost shape.
    const COL_BLOCKED_OPEN_FILL   = new Color(255, 60, 60, 160);
    const COL_BLOCKED_OPEN_STROKE = new Color(255, 60, 60, 255);
    for (const p of s.placedPieces) {
      const pCard = cardByNumberVariant(p.number, p.variant);
      const pOpt  = pCard?.options.find(o => o.option_index === p.optionIndex);
      if (!pOpt) continue;
      const pt = transformOption(pOpt, p.rotation, p.mirrored);
      for (const [pr, pc] of pt.open_spaces) {
        const wr = p.origin[0] + pr;
        const wc = p.origin[1] + pc;
        if (!ghostShapeCells.has(`${wr},${wc}`)) continue;
        // This open cell would be blocked — draw a red ring.
        const cx = edgeX(wc) + cell / 2;
        const cy = edgeY(wr) - cell / 2;
        const hr = cell * 0.38;
        g.fillColor   = COL_BLOCKED_OPEN_FILL;
        g.strokeColor = COL_BLOCKED_OPEN_STROKE;
        g.lineWidth   = 2;
        g.rect(edgeX(wc) + 2, edgeY(wr) - cell + 2, cell - 4, cell - 4);
        g.fill();
        g.circle(cx, cy, hr);
        g.stroke();
      }
    }
  }
}
