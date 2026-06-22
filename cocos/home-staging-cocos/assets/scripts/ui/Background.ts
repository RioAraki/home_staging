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

    // Each layer is its OWN Graphics node — a single Graphics doesn't reset its
    // path between fill()/stroke(), which would mangle the grid.
    const mk = (name: string): Graphics => {
      const n = new Node(name);
      this.node.addChild(n);
      n.addComponent(UITransform).setContentSize(W, H);
      return n.addComponent(Graphics);
    };

    // Base dark-navy fill.
    const base = mk('base');
    base.fillColor = new Color(11, 18, 31, 255);
    base.rect(-W / 2, -H / 2, W, H);
    base.fill();

    // Soft upper-centre glow (stacked translucent discs ≈ a faint radial light).
    const glow = mk('glow');
    for (let i = 0; i < 4; i++) {
      glow.fillColor = new Color(34, 56, 96, 10);
      glow.circle(0, H * 0.16, W * (0.62 - i * 0.13));
      glow.fill();
    }

    // Blueprint grid — larger pitch than the floor-plan's so the two never read
    // as the same grid. Visible enough to actually show the motif.
    const grid = mk('grid');
    grid.strokeColor = new Color(110, 152, 222, 50);
    grid.lineWidth = 2.5;
    const STEP = 92;
    for (let x = -W / 2; x <= W / 2; x += STEP) { grid.moveTo(x, -H / 2); grid.lineTo(x, H / 2); }
    for (let y = -H / 2; y <= H / 2; y += STEP) { grid.moveTo(-W / 2, y); grid.lineTo(W / 2, y); }
    grid.stroke();
  }
}
