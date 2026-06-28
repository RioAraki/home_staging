import {
  _decorator, Component, Node, Sprite, SpriteFrame, resources, Color, Graphics,
  Vec3, tween, Tween, UITransform,
} from 'cc';
const { ccclass } = _decorator;

/**
 * 示意手:一个 Sprite,加载玩家放在 `assets/resources/tutorial/hand.png` 的手图标
 * (按规范该 PNG 的 .meta 要 trimType:none)。图标缺失时退化为一个中性的小圆点
 * 占位(不画"假手")。所有方法接收的坐标是【overlay 本地坐标】——本节点是 overlay
 * 的子节点,所以本地坐标 = 直接 setPosition,无需世界坐标转换。
 */
@ccclass('HandPointer')
export class HandPointer extends Component {
  private anim: Tween<Node> | null = null;
  private sprite!: Sprite;
  private placeholder!: Graphics;

  onLoad() {
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setContentSize(72, 72);
    ui.setAnchorPoint(0.5, 0.5);

    this.sprite = this.node.addComponent(Sprite);
    this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;

    this.placeholder = this.node.addComponent(Graphics);
    this.drawPlaceholder();

    // 玩家提供的手图标(可选)。放好后这里自动接管,占位点消失。
    resources.load('tutorial/hand/spriteFrame', SpriteFrame, (err, sf) => {
      if (!err && sf && this.node.isValid) {
        this.sprite.spriteFrame = sf;
        this.node.getComponent(UITransform)!.setContentSize(72, 72);
        this.placeholder.clear();
      }
    });
  }

  /** 中性占位:一个白圆点(不是假手)。 */
  private drawPlaceholder() {
    const g = this.placeholder; g.clear();
    g.fillColor = new Color(255, 255, 255, 230);
    g.circle(0, 0, 13); g.fill();
    g.strokeColor = new Color(60, 45, 35, 255); g.lineWidth = 3;
    g.circle(0, 0, 13); g.stroke();
  }

  private stop() {
    if (this.anim) { this.anim.stop(); this.anim = null; }
    this.node.setScale(1, 1, 1);
  }

  /** 立刻定位(overlay 本地坐标)。 */
  setPos(local: Vec3) { this.node.setPosition(local.x, local.y, 0); }

  /** 原地缩放脉冲——「点这里」。 */
  playTap(local: Vec3) {
    this.stop();
    this.setPos(local);
    this.anim = tween(this.node)
      .repeatForever(tween(this.node)
        .to(0.45, { scale: new Vec3(0.8, 0.8, 1) })
        .to(0.45, { scale: new Vec3(1, 1, 1) }))
      .start();
  }

  /** 全路径拖拽:从 from 滑到 to,循环(均为 overlay 本地坐标)。 */
  playDrag(from: Vec3, to: Vec3) {
    this.stop();
    const a = new Vec3(from.x, from.y, 0), b = new Vec3(to.x, to.y, 0);
    this.node.setPosition(a);
    this.anim = tween(this.node)
      .repeatForever(tween(this.node)
        .set({ position: a })
        .to(0.85, { position: b })
        .delay(0.35))
      .start();
  }

  /** 左右抖动:「这里不能点」。 */
  shake() {
    const p = this.node.position.clone();
    tween(this.node)
      .to(0.05, { position: new Vec3(p.x - 6, p.y, 0) })
      .to(0.05, { position: new Vec3(p.x + 6, p.y, 0) })
      .to(0.05, { position: p })
      .start();
  }
}
