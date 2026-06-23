import { _decorator, Component, Node, UITransform, Graphics, view } from 'cc';
import { SAND_BG, SAND_TEXTURE } from './uiTheme';
const { ccclass } = _decorator;

/**
 * Full-screen warm-sand background (bright "暖沙米色" theme) with a faint, slowly
 * drifting diagonal hairline texture — a subtle "woven paper / fabric" motif that
 * gives the bright surface some life without stealing focus from the floor plan.
 * Pure Graphics (zero asset weight). Mounted on the Canvas by GameBootstrap at
 * sibling index 0 so it sits behind everything.
 *
 * The drift is done by translating a single pre-drawn texture layer and wrapping
 * it by exactly one line-spacing — for 45° lines (x − y = c) a horizontal shift
 * of one spacing maps every line onto its neighbour, so the loop is seamless and
 * costs nothing per frame beyond a position set (no per-frame redraw).
 */
@ccclass('Background')
export class Background extends Component {
  /** Horizontal spacing between diagonal lines (= the seamless drift period). */
  private static readonly PERIOD = 46;
  /** Seconds for the texture to drift one full period (slow). */
  private static readonly LOOP_SECONDS = 14;

  private texNode?: Node;
  private offset = 0;

  start() {
    this.draw();
  }

  update(dt: number) {
    if (!this.texNode || !this.texNode.isValid) return;
    this.offset += (Background.PERIOD / Background.LOOP_SECONDS) * dt;
    if (this.offset >= Background.PERIOD) this.offset -= Background.PERIOD;
    const p = this.texNode.position;
    this.texNode.setPosition(this.offset, p.y, p.z);
  }

  private draw() {
    this.node.destroyAllChildren();
    const visW = view.getVisibleSize().width;
    const visH = view.getVisibleSize().height;
    const W = visW + 80, H = visH + 80;   // bleed past the edges
    const HW = W / 2, HH = H / 2;

    const mk = (name: string): Graphics => {
      const n = new Node(name);
      this.node.addChild(n);
      n.addComponent(UITransform).setContentSize(W, H);
      return n.addComponent(Graphics);
    };

    // Warm-sand base fill.
    const base = mk('base');
    base.fillColor = SAND_BG;
    base.rect(-HW, -HH, W, H);
    base.fill();

    // Diagonal hairline texture (45°, x − y = c). Drawn once over a region a bit
    // wider than the screen on both sides so the drift never exposes an edge.
    const tex = mk('texture');
    this.texNode = tex.node;
    tex.strokeColor = SAND_TEXTURE;
    tex.lineWidth = 2.4;
    const P = Background.PERIOD;
    for (let c = -(HW + HH) - P; c <= (HW + HH) + P; c += P) {
      tex.moveTo(c - HH, -HH);
      tex.lineTo(c + HH, HH);
    }
    tex.stroke();
  }
}
