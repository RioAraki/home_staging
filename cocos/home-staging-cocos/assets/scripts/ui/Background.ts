import { _decorator, Component, Node, UITransform, Graphics, Color, view } from 'cc';
const { ccclass } = _decorator;

/**
 * Full-screen "blueprint" background (UI-improvement E1, direction B): a dark
 * navy base with a faint, large-pitch blue grid — an architect's drafting-paper
 * vibe that fits the home-design theme without stealing focus from the floor
 * plan. Pure Graphics (zero asset weight). Mounted on the Canvas by
 * GameBootstrap at sibling index 0 so it sits behind everything.
 *
 * Kept deliberately faint and at a LARGER pitch than the floor-plan grid so the
 * two never read as the same grid.
 */
@ccclass('Background')
export class Background extends Component {
  start() {
    this.draw();
  }

  private draw() {
    this.node.destroyAllChildren();
    const visW = view.getVisibleSize().width;
    const visH = view.getVisibleSize().height;
    const W = visW + 80, H = visH + 80;   // bleed past the edges

    const bg = new Node('bg');
    this.node.addChild(bg);
    bg.addComponent(UITransform).setContentSize(W, H);
    const g = bg.addComponent(Graphics);

    // Base dark-navy fill.
    g.fillColor = new Color(11, 18, 31, 255);
    g.rect(-W / 2, -H / 2, W, H);
    g.fill();

    // Soft upper-centre glow (stacked translucent discs ≈ a faint radial light).
    for (let i = 0; i < 4; i++) {
      g.fillColor = new Color(34, 56, 96, 9);
      g.circle(0, H * 0.16, W * (0.62 - i * 0.13));
      g.fill();
    }

    // Faint blueprint grid — larger pitch + very low alpha so it never clashes
    // with the floor-plan's own grid.
    g.strokeColor = new Color(95, 135, 205, 13);
    g.lineWidth = 1;
    const STEP = 88;
    for (let x = -W / 2; x <= W / 2; x += STEP) { g.moveTo(x, -H / 2); g.lineTo(x, H / 2); }
    for (let y = -H / 2; y <= H / 2; y += STEP) { g.moveTo(-W / 2, y); g.lineTo(W / 2, y); }
    g.stroke();
  }
}
