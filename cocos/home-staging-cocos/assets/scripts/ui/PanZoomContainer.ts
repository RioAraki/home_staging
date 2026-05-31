import { _decorator, Component, Node, EventTouch, EventMouse, Vec3, math } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('PanZoomContainer')
export class PanZoomContainer extends Component {
  @property(Node) content!: Node;   // FloorPlan goes here

  @property minScale = 0.6;
  @property maxScale = 2.5;
  @property panMargin = 200;

  private dragging = false;
  private dragStartTouch = new Vec3();
  private dragStartContent = new Vec3();

  private touches = new Map<number, { x: number; y: number }>();
  private pinchStartDist = 0;
  private pinchStartScale = 1;

  onLoad() {
    this.node.on(Node.EventType.TOUCH_START,  this.onTouchStart, this);
    this.node.on(Node.EventType.TOUCH_MOVE,   this.onTouchMove,  this);
    this.node.on(Node.EventType.TOUCH_END,    this.onTouchEnd,   this);
    this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd,   this);
    this.node.on(Node.EventType.MOUSE_WHEEL,  this.onWheel,      this);
  }

  private onTouchStart(e: EventTouch) {
    const touchId = e.touch?.getID() ?? 0;
    this.touches.set(touchId, { x: e.getUILocation().x, y: e.getUILocation().y });
    if (this.touches.size === 2) {
      this.dragging = false;
      const [t1, t2] = Array.from(this.touches.values());
      this.pinchStartDist = Math.hypot(t1.x - t2.x, t1.y - t2.y);
      this.pinchStartScale = this.content.scale.x;
      return;
    }
    if (e.propagationStopped) return;
    const p = e.getUILocation();
    this.dragStartTouch.set(p.x, p.y, 0);
    this.dragStartContent.set(this.content.position);
    this.dragging = true;
  }

  private onTouchMove(e: EventTouch) {
    const touchId = e.touch?.getID() ?? 0;
    this.touches.set(touchId, { x: e.getUILocation().x, y: e.getUILocation().y });
    if (this.touches.size >= 2) {
      const [t1, t2] = Array.from(this.touches.values());
      const dist = Math.hypot(t1.x - t2.x, t1.y - t2.y);
      if (this.pinchStartDist > 0) {
        const next = math.clamp(
          this.pinchStartScale * (dist / this.pinchStartDist),
          this.minScale,
          this.maxScale,
        );
        this.content.setScale(next, next, 1);
      }
      return;
    }
    if (!this.dragging) return;
    const p = e.getUILocation();
    const dx = p.x - this.dragStartTouch.x;
    const dy = p.y - this.dragStartTouch.y;
    this.content.setPosition(
      math.clamp(this.dragStartContent.x + dx, -this.panMargin, this.panMargin),
      math.clamp(this.dragStartContent.y + dy, -this.panMargin, this.panMargin),
      0,
    );
  }

  private onTouchEnd(e: EventTouch) {
    const touchId = e.touch?.getID() ?? 0;
    this.touches.delete(touchId);
    if (this.touches.size < 2) this.pinchStartDist = 0;
    if (this.touches.size === 0) this.dragging = false;
  }

  private onWheel(e: EventMouse) {
    const delta = e.getScrollY();
    const cur = this.content.scale.x;
    const next = math.clamp(cur * (delta > 0 ? 1.1 : 0.9), this.minScale, this.maxScale);
    this.content.setScale(next, next, 1);
  }
}
