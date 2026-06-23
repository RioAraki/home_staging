import { _decorator, Component, Node, UITransform, Graphics, view } from 'cc';
import { PANEL, ACCENT } from './uiTheme';
const { ccclass } = _decorator;

/**
 * A slim header band pinned to the top of the screen, drawn BEHIND the header
 * content (room-progress panel, reward goal, settings gear). Gives the top a
 * single defined block instead of three loose elements floating on black
 * (UI-improvement B1). Mounted on the Canvas by GameBootstrap (no scene wiring),
 * with sibling index 0 so it sits behind everything else.
 */
@ccclass('HeaderBar')
export class HeaderBar extends Component {
  start() {
    this.draw();
  }

  /** Re-draw to the current visible size (call again on resize if needed). */
  private draw() {
    this.node.destroyAllChildren();
    const visW = view.getVisibleSize().width;
    const visH = view.getVisibleSize().height;
    const bandH = Math.min(120, visH * 0.085);   // slim header band (A1)
    const W = visW + 40;                          // bleed past the edges

    const band = new Node('band');
    this.node.addChild(band);
    band.setPosition(0, visH / 2 - bandH / 2, 0); // Canvas centre origin → pin to top
    band.addComponent(UITransform).setContentSize(W, bandH);

    const g = band.addComponent(Graphics);
    g.fillColor = PANEL;
    g.rect(-W / 2, -bandH / 2, W, bandH);
    g.fill();
    // Terracotta bottom divider so the header reads as its own block.
    g.strokeColor = ACCENT;
    g.lineWidth = 2;
    g.moveTo(-W / 2, -bandH / 2);
    g.lineTo(W / 2, -bandH / 2);
    g.stroke();
  }
}
