import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Map is fixed for the WeChat build: no pan, no zoom. This component is kept
 * (so existing scene wiring stays valid) but is now inert — it just pins the
 * content to identity scale/position at scale 1, centred. All pinch/drag/wheel
 * handling has been removed; touches pass straight through to InputHandler.
 *
 * See docs/superpowers/specs/2026-06-02-fixed-cropped-map-design.md.
 */
@ccclass('PanZoomContainer')
export class PanZoomContainer extends Component {
  @property(Node) content!: Node;   // FloorPlan goes here

  onLoad() {
    if (this.content) {
      this.content.setScale(1, 1, 1);
      this.content.setPosition(0, 0, 0);
    }
  }
}
