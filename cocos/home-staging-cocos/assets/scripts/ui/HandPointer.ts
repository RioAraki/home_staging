import { _decorator, Component, Node, Graphics, Color, Vec3, tween, Tween, UITransform } from 'cc';
const { ccclass } = _decorator;

/**
 * 示意手:用 Graphics 矢量绘制一只指向手(零美术资产),配 拖/点/旋转 三种循环手势
 * 和一个「不能点」的抖动反馈。指尖压在节点原点附近,所以把节点放到目标点即可。
 * 将来想换成 PNG 图标,只需把 drawHand() 换成一个 Sprite。
 */
@ccclass('HandPointer')
export class HandPointer extends Component {
  private g!: Graphics;
  private anim: Tween<Node> | null = null;

  onLoad() {
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setContentSize(64, 64);
    this.g = this.node.addComponent(Graphics);
    this.drawHand();
  }

  /** 朝左上方指的手:白填充 + 深描边,指尖在节点原点附近。 */
  private drawHand() {
    const g = this.g;
    g.clear();
    g.fillColor = new Color(255, 255, 255, 255);
    g.strokeColor = new Color(60, 45, 35, 255);
    g.lineWidth = 3;
    g.roundRect(-6, -34, 12, 26, 6); g.fill(); g.stroke();   // 食指(指尖在上)
    g.roundRect(-16, -40, 34, 26, 10); g.fill(); g.stroke(); // 手掌
    g.roundRect(-26, -34, 14, 12, 6); g.fill(); g.stroke();  // 拇指
  }

  private stop() {
    if (this.anim) { this.anim.stop(); this.anim = null; }
    this.node.setScale(1, 1, 1);
  }

  /** 立刻把指尖放到世界点(略偏移,指尖压在目标上)。 */
  pointAt(world: Vec3) {
    const local = this.toParentLocal(world);
    this.node.setPosition(local.x + 8, local.y - 8, 0);
  }

  /** 原地缩放脉冲——用于「点这个按钮/格子」。 */
  playTap(world: Vec3) {
    this.stop();
    this.pointAt(world);
    this.anim = tween(this.node)
      .repeatForever(tween(this.node)
        .to(0.45, { scale: new Vec3(0.82, 0.82, 1) })
        .to(0.45, { scale: new Vec3(1, 1, 1) }))
      .start();
  }

  /** 旋转手势——目前复用脉冲(弧线箭头可后续加)。 */
  playRotate(world: Vec3) { this.playTap(world); }

  /** 全路径拖拽:指尖从 from 滑到 to,循环。 */
  playDrag(fromWorld: Vec3, toWorld: Vec3) {
    this.stop();
    const a = this.toParentLocal(fromWorld), b = this.toParentLocal(toWorld);
    const pa = new Vec3(a.x + 8, a.y - 8, 0), pb = new Vec3(b.x + 8, b.y - 8, 0);
    this.node.setPosition(pa);
    this.anim = tween(this.node)
      .repeatForever(tween(this.node)
        .set({ position: pa })
        .to(0.9, { position: pb })
        .delay(0.3))
      .start();
  }

  /** 左右抖动:表示「这里不能点」。 */
  shake() {
    const p = this.node.position.clone();
    tween(this.node)
      .to(0.05, { position: new Vec3(p.x - 6, p.y, 0) })
      .to(0.05, { position: new Vec3(p.x + 6, p.y, 0) })
      .to(0.05, { position: p })
      .start();
  }

  private toParentLocal(world: Vec3): Vec3 {
    const pui = this.node.parent?.getComponent(UITransform);
    return pui ? pui.convertToNodeSpaceAR(world) : world.clone();
  }
}
