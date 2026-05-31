import { _decorator, Component, EventTouch, Node, Vec3, UITransform } from 'cc';
import { gameStore } from '../state/gameStore';
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
    if (!s.selectedOption) return;
    e.propagationStopped = true;
    this.moveGhost(e);
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
    s.placeSelected(this.ghost.getOrigin());
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
