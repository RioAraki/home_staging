import { _decorator, Component, Node, UITransform, Graphics, view, tween, Vec3 } from 'cc';
import { SAND_BG, SAND_TEXTURE } from './uiTheme';
const { ccclass } = _decorator;

/**
 * Full-screen warm-sand background (bright "暖沙米色" theme) with a faint diagonal
 * hairline texture that slowly drifts sideways — a subtle "woven paper / fabric"
 * motif that gives the bright surface some life without stealing focus from the
 * floor plan. Pure Graphics (zero asset weight). Mounted on the Canvas by
 * GameBootstrap at sibling index 0 so it sits behind everything.
 *
 * The drift is a node TWEEN (reliable every frame): each loop translates the
 * pre-drawn texture by exactly one line-spacing, then snaps back. For 45° lines
 * (x − y = c) a horizontal shift of one spacing maps every line onto its
 * neighbour, so the snap is invisible and the texture never drifts off-screen.
 */
@ccclass('Background')
export class Background extends Component {
  /** Horizontal spacing between diagonal lines (= the seamless drift period). */
  private static readonly PERIOD = 46;
  /** Seconds to drift one full period — gentle but clearly moving (~15 px/s). */
  private static readonly LOOP_SECONDS = 3;

  private texNode?: Node;

  start() {
    this.draw();
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

    // Continuous slow sideways drift: move one spacing over LOOP_SECONDS, then
    // snap back (seamless — the pattern is identical one spacing over).
    this.texNode.setPosition(0, 0, 0);
    tween(this.texNode)
      .repeatForever(
        tween(this.texNode)
          .to(Background.LOOP_SECONDS, { position: new Vec3(P, 0, 0) }, { easing: 'linear' })
          .call(() => { if (this.texNode?.isValid) this.texNode.setPosition(0, 0, 0); }),
      )
      .start();
  }
}
