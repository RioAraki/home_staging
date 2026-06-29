import { _decorator, Component, Node, Graphics, Color, Label, UITransform, view, Vec3, EventTouch } from 'cc';
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
  private confirmBtn!: Node;
  private confirmCb: (() => void) | null = null;

  onLoad() {
    const vs = view.getVisibleSize();
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setContentSize(vs.width, vs.height);
    this.g = this.node.addComponent(Graphics);

    // 文字气泡固定在屏幕顶部(让出整个户型图,不遮挡高亮)。
    this.bubble = new Node('bubble');
    this.node.addChild(this.bubble);
    this.bubble.addComponent(UITransform).setContentSize(560, 64);
    this.bubble.setPosition(0, vs.height / 2 - 90, 0);
    this.bubbleBg = this.bubble.addComponent(Graphics);

    const lblNode = new Node('text');
    this.bubble.addChild(lblNode);
    lblNode.addComponent(UITransform).setContentSize(530, 60);
    this.label = lblNode.addComponent(Label);
    this.label.fontSize = 24;
    this.label.lineHeight = 30;
    this.label.color = new Color(255, 255, 255, 255);
    this.label.enableWrapText = true;

    // 「确定」按钮(讲解步用),默认隐藏,挂在气泡正下方。
    this.confirmBtn = new Node('TutorialConfirm');
    this.node.addChild(this.confirmBtn);
    this.confirmBtn.addComponent(UITransform).setContentSize(160, 56);
    this.confirmBtn.setPosition(0, vs.height / 2 - 156, 0);
    const cg = this.confirmBtn.addComponent(Graphics);
    cg.fillColor = new Color(78, 157, 84, 255);
    cg.roundRect(-80, -28, 160, 56, 10); cg.fill();
    const clbl = new Node('label'); this.confirmBtn.addChild(clbl);
    clbl.addComponent(UITransform).setContentSize(160, 56);
    const cl = clbl.addComponent(Label);
    cl.string = '我知道了'; cl.fontSize = 26; cl.color = new Color(255, 255, 255, 255);
    this.confirmBtn.on(Node.EventType.TOUCH_END, (_e: EventTouch) => { this.confirmCb?.(); });
    this.confirmBtn.active = false;
  }

  /** 显示「确定」按钮并在点击时回调(讲解步推进用)。 */
  showConfirm(cb: () => void) { this.confirmCb = cb; this.confirmBtn.active = true; }
  hideConfirm() { this.confirmBtn.active = false; this.confirmCb = null; }

  /** 变暗整屏,并给【多个】目标挖亮洞 + 金色高亮边框。
   *  洞坐标用本节点本地坐标(中心原点),{x,y} 中心、{hw,hh} 半尺寸。
   *  用「水平分带 + 每带挖洞 x 区间」实现任意多洞(Graphics 不能布尔挖洞)。 */
  setHoles(holes: { x: number; y: number; hw: number; hh: number }[]) {
    const vs = view.getVisibleSize();
    const W = vs.width, H = vs.height;
    const g = this.g; g.clear();
    g.fillColor = new Color(0, 0, 0, 150);
    if (holes.length === 0) { g.rect(-W / 2, -H / 2, W, H); g.fill(); return; }

    const clampY = (y: number) => Math.max(-H / 2, Math.min(H / 2, y));
    const ys = new Set<number>([-H / 2, H / 2]);
    for (const h of holes) { ys.add(clampY(h.y - h.hh)); ys.add(clampY(h.y + h.hh)); }
    const sortedY = Array.from(ys).sort((a, b) => a - b);

    for (let i = 0; i < sortedY.length - 1; i++) {
      const yb0 = sortedY[i], yb1 = sortedY[i + 1];
      if (yb1 - yb0 < 0.5) continue;
      const ymid = (yb0 + yb1) / 2;
      const xs = holes
        .filter(h => h.y - h.hh <= ymid && h.y + h.hh >= ymid)
        .map(h => [Math.max(-W / 2, h.x - h.hw), Math.min(W / 2, h.x + h.hw)] as [number, number])
        .sort((a, b) => a[0] - b[0]);
      let cursor = -W / 2;
      for (const [x0, x1] of xs) {
        if (x0 > cursor) { g.rect(cursor, yb0, x0 - cursor, yb1 - yb0); g.fill(); }
        cursor = Math.max(cursor, x1);
      }
      if (cursor < W / 2) { g.rect(cursor, yb0, W / 2 - cursor, yb1 - yb0); g.fill(); }
    }

    // 金色高亮边框,标出每个洞。
    g.strokeColor = new Color(255, 224, 130, 220);
    g.lineWidth = 3;
    for (const h of holes) { g.rect(h.x - h.hw, h.y - h.hh, h.hw * 2, h.hh * 2); g.stroke(); }
  }

  /** 无洞的整屏变暗(纯文字步可用)。 */
  setFull() {
    const vs = view.getVisibleSize();
    this.g.clear();
    this.g.fillColor = new Color(0, 0, 0, 150);
    this.g.rect(-vs.width / 2, -vs.height / 2, vs.width, vs.height); this.g.fill();
  }

  /** 设置气泡文字。气泡固定在顶部(不随目标移动,以免遮挡户型图高亮)。 */
  setBubble(text: string, _anchor?: Vec3) {
    this.label.string = text;
    const bg = this.bubbleBg; bg.clear();
    bg.fillColor = new Color(40, 30, 25, 235);
    bg.roundRect(-280, -32, 560, 64, 12); bg.fill();
  }
}
