import { _decorator, Component, Graphics, Color } from 'cc';
import { gameStore, shouldSuppressOpenCellCheck } from '../state/gameStore';
import { resolveOption } from '../core/pieces';
import { transformOption } from '../core/geometry';
import { validatePlacement } from '../core/validation';
import { computeFloorReachability } from '../core/regions';
import { layout, edgeX, edgeY, FULL_GRID_ROWS, FULL_GRID_COLS } from './viewport';
const { ccclass } = _decorator;

const COL_OK_FILL    = new Color(255, 225, 105, 90);
const COL_OK_STROKE  = new Color(255, 225, 105, 255);
const COL_BAD_FILL   = new Color(255, 90, 90, 100);
const COL_BAD_STROKE = new Color(255, 70, 70, 255);

@ccclass('GhostPiece')
export class GhostPiece extends Component {
  private unsub?: () => void;
  /** Origin in grid coords [row, col] of the top-left of the bbox. */
  private origin: [number, number] = [8, 8];
  /** The ghost is hidden until the player drags it onto the plan (so picking
   *  an option in the tray no longer auto-hovers a piece on the floor plan). */
  private positioned = false;

  start() {
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

    const opt = resolveOption(sel);
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

    // The "does this ghost block / trap other furniture" checks below only matter
    // when the ghost can actually be placed here. If the placement itself is
    // invalid, the ghost is already red (above) — leave ONLY the ghost red and
    // skip analysing / red-flagging other pieces.
    if (!valid) return;

    // Highlight existing open-space cells that the ghost's shape would block.
    // Build the set of world cells the ghost shape occupies.
    const ghostShapeCells = new Set<string>();
    for (const [r, c] of t.shape) ghostShapeCells.add(`${or + r},${oc + c}`);

    // For each placed piece, find open_spaces that intersect with ghost shape.
    const COL_BLOCKED_OPEN_FILL   = new Color(255, 60, 60, 160);
    const COL_BLOCKED_OPEN_STROKE = new Color(255, 60, 60, 255);
    for (const p of s.placedPieces) {
      const pOpt = resolveOption(p);
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

    // Predictive "trapped furniture" highlight: would placing the ghost here
    // enclose any piece's open cells so they can no longer be walked to? If so,
    // paint that piece's shape AND its unreachable open cells red — including
    // the ghost itself. This is a WARNING only; placement legality is still
    // decided by validatePlacement above (the ghost may stay yellow/placeable).
    //
    // Suppressed in the same phases as FloorPlan.redrawInaccessibleOpen:
    // only while actively constructing a room (drawing walls, or placing its
    // door before any door exists). During furniture placement — when this
    // ghost is being dragged — the check runs. See shouldSuppressOpenCellCheck.
    if (s.scenario && !shouldSuppressOpenCellCheck(s)) {
      const { walkable, reachable } = computeFloorReachability(
        s.scenario, s.placedPieces, s.walls, s.doors, s.frontDoorEdge, ghostShapeCells,
      );
      const isTrappedCell = (k: string) => walkable.has(k) && !reachable.has(k);

      const COL_TRAP_FILL   = new Color(255, 60, 60, 110);
      const COL_TRAP_STROKE = new Color(255, 60, 60, 255);
      const trapHr = cell * 0.38;
      const drawTrappedShapeCell = (wr: number, wc: number) => {
        const x = edgeX(wc), y = edgeY(wr) - cell;
        g.fillColor = COL_TRAP_FILL;
        g.strokeColor = COL_TRAP_STROKE;
        g.lineWidth = 2;
        g.rect(x, y, cell, cell); g.fill();
        g.rect(x, y, cell, cell); g.stroke();
      };
      const drawTrappedOpenCell = (wr: number, wc: number) => {
        const cx = edgeX(wc) + cell / 2;
        const cy = edgeY(wr) - cell / 2;
        g.fillColor = COL_TRAP_FILL;
        g.strokeColor = COL_TRAP_STROKE;
        g.lineWidth = 2;
        g.rect(edgeX(wc) + 2, edgeY(wr) - cell + 2, cell - 4, cell - 4); g.fill();
        g.circle(cx, cy, trapHr); g.stroke();
      };
      const markPieceIfTrapped = (
        shapeCells: Array<[number, number]>, openCells: Array<[number, number]>,
      ) => {
        const trappedOpens = openCells.filter(([r, c]) => isTrappedCell(`${r},${c}`));
        if (trappedOpens.length === 0) return;
        for (const [r, c] of shapeCells) drawTrappedShapeCell(r, c);
        for (const [r, c] of trappedOpens) drawTrappedOpenCell(r, c);
      };

      // Already-placed pieces.
      for (const p of s.placedPieces) {
        const pOpt = resolveOption(p);
        if (!pOpt) continue;
        const pt = transformOption(pOpt, p.rotation, p.mirrored);
        const shapeWorld = pt.shape.map(([r, c]) => [p.origin[0] + r, p.origin[1] + c] as [number, number]);
        const openWorld  = pt.open_spaces.map(([r, c]) => [p.origin[0] + r, p.origin[1] + c] as [number, number]);
        markPieceIfTrapped(shapeWorld, openWorld);
      }

      // The ghost piece itself.
      const ghostShapeWorld = t.shape.map(([r, c]) => [or + r, oc + c] as [number, number]);
      const ghostOpenWorld  = t.open_spaces.map(([r, c]) => [or + r, oc + c] as [number, number]);
      markPieceIfTrapped(ghostShapeWorld, ghostOpenWorld);
    }
  }
}
