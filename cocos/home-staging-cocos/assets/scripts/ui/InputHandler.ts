import { _decorator, Component, EventTouch, Node, Vec3, UITransform } from 'cc';
import { gameStore } from '../state/gameStore';
import { cardByNumberVariant } from '../core/dataLoader';
import { validatePlacement } from '../core/validation';
import { transformOption } from '../core/geometry';
import { CELL_SIZE, GRID_ROWS, GRID_COLS } from './LayerRenderer';
import { GhostPiece } from './GhostPiece';
const { ccclass, property } = _decorator;

const EDGE_SLOP = 12;

export type HitResult =
  | { kind: 'cell'; row: number; col: number }
  | { kind: 'edge'; key: string; row: number; col: number; side: 'top'|'right'|'bottom'|'left' }
  | { kind: 'outside' };

@ccclass('InputHandler')
export class InputHandler extends Component {
  @property(Node)       floorPlan!: Node;
  @property(GhostPiece) ghost!: GhostPiece;

  onLoad() {
    this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.on(Node.EventType.TOUCH_MOVE,  this.onTouchMove,  this);
    this.node.on(Node.EventType.TOUCH_END,   this.onTouchEnd,   this);
  }

  private onTouchStart(e: EventTouch) {
    const s = gameStore.getState();
    if (s.selectedOption) {
      e.propagationStopped = true;
      this.moveGhost(e);
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
    this.moveGhost(e);
  }

  private onTouchEnd(e: EventTouch) {
    const s = gameStore.getState();
    if (!s.selectedOption) return;
    e.propagationStopped = true;
    // NOTE: Do NOT auto-place on touch end. Ghost just stays where the user
    // dragged it. They confirm via the "✓ 放置" button in SelectionStatus.
    // Rationale: with auto-place, players can't rotate/mirror because any
    // touch up commits placement.
  }

  /** Called by SelectionStatus's Place button. Validates first. */
  tryPlaceAtGhost() {
    const s = gameStore.getState();
    const sel = s.selectedOption;
    if (!sel || !s.scenario) return;
    const card = cardByNumberVariant(sel.number, sel.variant);
    const opt = card?.options.find(o => o.option_index === sel.optionIndex);
    if (!opt) return;

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

  private moveGhost(e: EventTouch) {
    const hit = this.hitTest(e);
    if (hit.kind === 'cell') {
      this.ghost.setOrigin(hit.row, hit.col);
    }
  }

  hitTest(e: EventTouch): HitResult {
    if (!this.floorPlan) return { kind: 'outside' };
    const ui = this.floorPlan.getComponent(UITransform);
    if (!ui) return { kind: 'outside' };
    const world = new Vec3(e.getUILocation().x, e.getUILocation().y, 0);
    const local = ui.convertToNodeSpaceAR(world);
    const W = GRID_COLS * CELL_SIZE;
    const H = GRID_ROWS * CELL_SIZE;
    const x = local.x + W / 2;
    const y = H / 2 - local.y;
    if (x < 0 || y < 0 || x >= W || y >= H) return { kind: 'outside' };
    const cellX = Math.floor(x / CELL_SIZE);
    const cellY = Math.floor(y / CELL_SIZE);
    const lx = x - cellX * CELL_SIZE;
    const ly = y - cellY * CELL_SIZE;
    const distTop    = ly;
    const distBottom = CELL_SIZE - ly;
    const distLeft   = lx;
    const distRight  = CELL_SIZE - lx;
    const minDist = Math.min(distTop, distBottom, distLeft, distRight);

    if (minDist >= EDGE_SLOP) {
      return { kind: 'cell', row: cellY, col: cellX };
    }
    let side: 'top'|'right'|'bottom'|'left';
    if      (minDist === distTop)    side = 'top';
    else if (minDist === distBottom) side = 'bottom';
    else if (minDist === distLeft)   side = 'left';
    else                              side = 'right';

    let key: string;
    if      (side === 'top')    key = `h:${cellY}:${cellX}`;
    else if (side === 'bottom') key = `h:${cellY + 1}:${cellX}`;
    else if (side === 'left')   key = `v:${cellY}:${cellX}`;
    else                         key = `v:${cellY}:${cellX + 1}`;
    return { kind: 'edge', key, row: cellY, col: cellX, side };
  }
}
