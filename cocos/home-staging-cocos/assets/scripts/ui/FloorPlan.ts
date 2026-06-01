import { _decorator, Component, Graphics, Node, UITransform, view } from 'cc';
import { gameStore } from '../state/gameStore';
import { drawGridBg, drawWalls, drawDoors, drawWindows, drawPreDrawn } from './LayerRenderer';
import { computeLayout, setLayout, layout } from './viewport';
import { PlacedPiece } from './PlacedPiece';
const { ccclass, property } = _decorator;

@ccclass('FloorPlan')
export class FloorPlan extends Component {
  @property(Node) gridBg!: Node;
  @property(Node) preDrawnLayer!: Node;
  @property(Node) placedLayer!: Node;
  @property(Node) wallsLayer!: Node;
  @property(Node) doorsLayer!: Node;
  @property(Node) windowsLayer!: Node;

  private unsub?: () => void;

  start() {
    this.renderAll();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.scenario !== prev.scenario) this.renderAll();
      if (s.placedPieces !== prev.placedPieces) this.rebuildPlacedLayer();
      if (s.walls !== prev.walls) this.redrawWalls();
      if (s.doors !== prev.doors) this.redrawDoors();
      if (s.windows !== prev.windows) this.redrawWindows();
    });
  }

  onDestroy() { this.unsub?.(); }

  /** Available area to fit the map into: the FloorPlan's parent container, or
   *  a fraction of the visible screen if the parent isn't sized. */
  private availSize(): { w: number; h: number } {
    const parentUi = this.node.parent?.getComponent(UITransform);
    if (parentUi && parentUi.contentSize.width > 0 && parentUi.contentSize.height > 0) {
      return { w: parentUi.contentSize.width, h: parentUi.contentSize.height };
    }
    const vis = view.getVisibleSize();
    // Fallback: leave room for the top toolbar and bottom card tray.
    return { w: vis.width, h: vis.height * 0.55 };
  }

  private applyLayout() {
    const s = gameStore.getState();
    if (!s.scenario) return;
    const { w, h } = this.availSize();
    setLayout(computeLayout(s.scenario, w, h));
    // Match the node's own hit/visual area to the cropped map (anchor 0.5).
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setContentSize(layout().w, layout().h);
  }

  private renderAll() {
    const s = gameStore.getState();
    if (!s.scenario) return;
    this.applyLayout();
    const g = this.gridBg?.getComponent(Graphics);
    if (g) drawGridBg(g, s.scenario);
    const pg = this.preDrawnLayer?.getComponent(Graphics);
    if (pg) drawPreDrawn(pg, s.scenario);
    this.rebuildPlacedLayer();
    this.redrawWalls();
    this.redrawDoors();
    this.redrawWindows();
  }

  private rebuildPlacedLayer() {
    if (!this.placedLayer) return;
    this.placedLayer.removeAllChildren();
    for (const p of gameStore.getState().placedPieces) {
      const node = new Node('piece');
      this.placedLayer.addChild(node);
      const comp = node.addComponent(PlacedPiece);
      comp.init(p);
    }
  }

  private redrawWalls() {
    if (!this.wallsLayer) return;
    const g = this.wallsLayer.getComponent(Graphics);
    if (g) drawWalls(g, gameStore.getState().walls);
  }
  private redrawDoors() {
    if (!this.doorsLayer) return;
    const g = this.doorsLayer.getComponent(Graphics);
    if (g) drawDoors(g, gameStore.getState().doors);
  }
  private redrawWindows() {
    if (!this.windowsLayer) return;
    const g = this.windowsLayer.getComponent(Graphics);
    if (g) drawWindows(g, gameStore.getState().windows);
  }
}
