import { _decorator, Component, EventTouch, Node, Vec3, UITransform } from 'cc';
import { gameStore } from '../state/gameStore';
import { cardByNumberVariant } from '../core/dataLoader';
import { validatePlacement } from '../core/validation';
import { transformOption } from '../core/geometry';
import { hitTestLocal, type HitResult } from './viewport';
import { GhostPiece } from './GhostPiece';
const { ccclass, property } = _decorator;

export type { HitResult };

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
    return hitTestLocal(local.x, local.y);
  }
}
