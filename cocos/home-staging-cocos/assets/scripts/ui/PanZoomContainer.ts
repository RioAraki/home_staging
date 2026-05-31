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

  onLoad() {
    this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.on(Node.EventType.TOUCH_MOVE,  this.onTouchMove,  this);
    this.node.on(Node.EventType.TOUCH_END,   this.onTouchEnd,   this);
    this.node.on(Node.EventType.TOUCH_CANCEL,this.onTouchEnd,   this);
    this.node.on(Node.EventType.MOUSE_WHEEL, this.onWheel,      this);
  }

  private onTouchStart(e: EventTouch) {
    if (e.propagationStopped) return;
    const p = e.getUILocation();
    this.dragStartTouch.set(p.x, p.y, 0);
    this.dragStartContent.set(this.content.position);
    this.dragging = true;
  }

  private onTouchMove(e: EventTouch) {
    if (!this.dragging) return;
    const p = e.getUILocation();
    const dx = p.x - this.dragStartTouch.x;
    const dy = p.y - this.dragStartTouch.y;
    let nx = this.dragStartContent.x + dx;
    let ny = this.dragStartContent.y + dy;
    nx = math.clamp(nx, -this.panMargin, this.panMargin);
    ny = math.clamp(ny, -this.panMargin, this.panMargin);
    this.content.setPosition(nx, ny, 0);
  }

  private onTouchEnd() { this.dragging = false; }

  private onWheel(e: EventMouse) {
    const delta = e.getScrollY();
    const cur = this.content.scale.x;
    const next = math.clamp(cur * (delta > 0 ? 1.1 : 0.9), this.minScale, this.maxScale);
    this.content.setScale(next, next, 1);
  }
}
