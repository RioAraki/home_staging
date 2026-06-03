import { _decorator, Component, EventTouch, Node, Vec3, UITransform } from 'cc';
import { gameStore, type SelectedOption } from '../state/gameStore';
import { cardByNumberVariant } from '../core/dataLoader';
import { validatePlacement } from '../core/validation';
import { transformOption } from '../core/geometry';
import { hitTestLocal, cellAtLocal, type HitResult } from './viewport';
import { GhostPiece } from './GhostPiece';
const { ccclass, property } = _decorator;

export type { HitResult };

/** Movement (px) beyond which a touch is treated as a drag, not a tap. */
const DRAG_THRESHOLD = 10;

@ccclass('InputHandler')
export class InputHandler extends Component {
  @property(Node)       floorPlan!: Node;
  @property(GhostPiece) ghost!: GhostPiece;

  /** True once the current touch sequence has moved past the threshold. */
  private movedDuringDrag = false;
  private startX = 0;
  private startY = 0;

  onLoad() {
    this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.on(Node.EventType.TOUCH_MOVE,  this.onTouchMove,  this);
    this.node.on(Node.EventType.TOUCH_END,   this.onTouchEnd,   this);
  }

  private onTouchStart(e: EventTouch) {
    const s = gameStore.getState();
    if (s.selectedOption) {
      // Defer: decide tap (rotate / first-position) vs drag (reposition) on
      // move/end, so a tap meant to rotate doesn't jump the piece.
      e.propagationStopped = true;
      this.movedDuringDrag = false;
      const p = e.getUILocation();
      this.startX = p.x; this.startY = p.y;
      return;
    }
    const hit = this.hitTest(e);
    if (hit.kind === 'cell') {
      if (s.demolishMode) {
        e.propagationStopped = true;
        s.demolishAtCell([hit.row, hit.col]);
      }
      return;
    }
    if (hit.kind === 'edge') {
      e.propagationStopped = true;
      if (s.demolishMode) {
        s.demolishAtEdge(hit.key);
        return;
      }
      this.routeEdge(hit);
    }
  }

  private routeEdge(hit: HitResult & { kind: 'edge' }) {
    const s = gameStore.getState();
    if (s.frontDoorMode) { s.setFrontDoor(hit.key); return; }
    if (s.windowMode)    { s.toggleWindow(hit.key); return; }
    if (s.wallPhase === 'walls') s.toggleWall(hit.key);
    else                          s.setDoor(hit.key);
  }

  private onTouchMove(e: EventTouch) {
    if (!gameStore.getState().selectedOption) return;
    e.propagationStopped = true;
    if (!this.movedDuringDrag) {
      const p = e.getUILocation();
      if (Math.hypot(p.x - this.startX, p.y - this.startY) > DRAG_THRESHOLD) {
        this.movedDuringDrag = true;
      }
    }
    if (this.movedDuringDrag) this.moveGhost(e);   // drag → ghost follows finger
  }

  private onTouchEnd(e: EventTouch) {
    const s = gameStore.getState();
    const sel = s.selectedOption;
    if (!sel) return;
    e.propagationStopped = true;
    if (this.movedDuringDrag) { this.movedDuringDrag = false; return; }  // was a drag

    // It was a TAP on the plan.
    const c = this.cellAt(e);
    if (!c) return;
    if (!this.ghost.isPositioned()) {
      this.moveGhost(e);                  // first tap: drop the ghost here
    } else if (this.tapOnGhost(c.row, c.col, sel)) {
      s.rotateSelection(1);               // tap the piece → rotate
    } else {
      this.moveGhost(e);                  // tap elsewhere → move it there
    }
  }

  /** Is grid cell (row,col) one of the ghost's occupied cells right now? */
  private tapOnGhost(row: number, col: number, sel: SelectedOption): boolean {
    const card = cardByNumberVariant(sel.number, sel.variant);
    const opt = card?.options.find(o => o.option_index === sel.optionIndex);
    if (!opt) return false;
    const t = transformOption(opt, sel.rotation, sel.mirrored);
    const [or, oc] = this.ghost.getOrigin();
    return t.shape.some(([r, c]) => or + r === row && oc + c === col);
  }

  /** Called by SelectionStatus's Place button. Validates first. */
  tryPlaceAtGhost() {
    const s = gameStore.getState();
    const sel = s.selectedOption;
    if (!sel || !s.scenario) return;
    const card = cardByNumberVariant(sel.number, sel.variant);
    const opt = card?.options.find(o => o.option_index === sel.optionIndex);
    if (!opt) return;

    if (!this.ghost.isPositioned()) {
      s.setError('把家具拖到户型图上再放置');
      return;
    }
    const origin = this.ghost.getOrigin();
    const transformed = transformOption(opt, sel.rotation, sel.mirrored);
    const result = validatePlacement(
      s.scenario,
      transformed,
      origin,
      s.placedPieces,
      sel.number,
      s.doors,
      s.frontDoorEdge,
    );
    if (!result.valid) {
      s.setError(result.reason ?? '不能放在这里');
      return;
    }
    s.placeSelected(origin);
  }

  /** Public: drag the ghost to follow a touch — used when dragging an option
   *  out of the bottom tray onto the plan (the tray node captures that touch,
   *  so RoomPanel forwards the move events here). */
  dragGhost(e: EventTouch) { this.moveGhost(e); }

  private moveGhost(e: EventTouch) {
    // Use the containing cell (NO edge-slop dead-zone) so the ghost tracks the
    // finger everywhere on the grid, not only in each cell's central 16%.
    const c = this.cellAt(e);
    if (!c) return;
    const sel = gameStore.getState().selectedOption;
    if (!sel) return;
    // Centre the piece under the finger so it tracks the touch naturally.
    const card = cardByNumberVariant(sel.number, sel.variant);
    const opt = card?.options.find(o => o.option_index === sel.optionIndex);
    const t = opt ? transformOption(opt, sel.rotation, sel.mirrored) : null;
    const offR = t ? Math.floor(t.bbox[0] / 2) : 0;
    const offC = t ? Math.floor(t.bbox[1] / 2) : 0;
    this.ghost.setOrigin(c.row - offR, c.col - offC);
  }

  /** FloorPlan-local point → world-aware grid cell (no edge dead-zone). */
  private cellAt(e: EventTouch): { row: number; col: number } | null {
    if (!this.floorPlan) return null;
    const ui = this.floorPlan.getComponent(UITransform);
    if (!ui) return null;
    const world = new Vec3(e.getUILocation().x, e.getUILocation().y, 0);
    const local = ui.convertToNodeSpaceAR(world);
    return cellAtLocal(local.x, local.y);
  }

  hitTest(e: EventTouch): HitResult {
    if (!this.floorPlan) return { kind: 'outside' };
    const ui = this.floorPlan.getComponent(UITransform);
    if (!ui) return { kind: 'outside' };
    const world = new Vec3(e.getUILocation().x, e.getUILocation().y, 0);
    const local = ui.convertToNodeSpaceAR(world);
    return hitTestLocal(local.x, local.y);
  }
}
