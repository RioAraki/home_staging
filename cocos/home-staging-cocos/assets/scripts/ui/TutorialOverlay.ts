import { _decorator, Component, Node, Graphics, Color, Label, UITransform, view, Vec3 } from 'cc';
const { ccclass } = _decorator;

/**
 * 教程覆盖层:全屏变暗 + 给当前目标挖一个亮洞(把注意力锁死在该点的地方),
 * 外加一个跟随目标的文字气泡。Cocos Graphics 不支持布尔挖洞,所以用「上下左右
 * 四块矩形」围出中间留空的方式实现洞。
 */
@ccclass('TutorialOverlay')
export class TutorialOverlay extends Component {
  private g!: Graphics;
  private bubble!: Node;
  private bubbleBg!: Graphics;
  private label!: Label;

  onLoad() {
    const vs = view.getVisibleSize();
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setContentSize(vs.width, vs.height);
    this.g = this.node.addComponent(Graphics);

    this.bubble = new Node('bubble');
    this.node.addChild(this.bubble);
    this.bubble.addComponent(UITransform).setContentSize(360, 64);
    this.bubbleBg = this.bubble.addComponent(Graphics);

    const lblNode = new Node('text');
    this.bubble.addChild(lblNode);
    lblNode.addComponent(UITransform).setContentSize(330, 60);
    this.label = lblNode.addComponent(Label);
    this.label.fontSize = 24;
    this.label.lineHeight = 30;
    this.label.color = new Color(255, 255, 255, 255);
    this.label.enableWrapText = true;
  }

  /** 四矩形围出中间亮洞。center 用本节点本地坐标(中心原点),halfW/halfH 是洞半尺寸。 */
  setHole(center: Vec3, halfW: number, halfH: number) {
    const vs = view.getVisibleSize();
    const W = vs.width, H = vs.height;
    const g = this.g; g.clear();
    g.fillColor = new Color(0, 0, 0, 150);
    const L = center.x - halfW, R = center.x + halfW;
    const B = center.y - halfH, T = center.y + halfH;
    g.rect(-W / 2, T, W, H / 2 - T); g.fill();          // 上
    g.rect(-W / 2, -H / 2, W, B + H / 2); g.fill();      // 下
    g.rect(-W / 2, B, L + W / 2, T - B); g.fill();       // 左
    g.rect(R, B, W / 2 - R, T - B); g.fill();            // 右
  }

  /** 无洞的整屏变暗(纯文字步可用)。 */
  setFull() {
    const vs = view.getVisibleSize();
    this.g.clear();
    this.g.fillColor = new Color(0, 0, 0, 150);
    this.g.rect(-vs.width / 2, -vs.height / 2, vs.width, vs.height); this.g.fill();
  }

  /** 气泡定位到目标上方(出屏则翻到下方),并夹在屏幕内。 */
  setBubble(text: string, anchor: Vec3) {
    this.label.string = text;
    const vs = view.getVisibleSize();
    let y = anchor.y + 80;
    if (y > vs.height / 2 - 40) y = anchor.y - 80;
    const x = Math.max(-vs.width / 2 + 190, Math.min(vs.width / 2 - 190, anchor.x));
    this.bubble.setPosition(x, y, 0);
    const bg = this.bubbleBg; bg.clear();
    bg.fillColor = new Color(40, 30, 25, 235);
    bg.roundRect(-180, -32, 360, 64, 12); bg.fill();
  }
}
