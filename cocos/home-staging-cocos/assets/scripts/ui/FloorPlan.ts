import { _decorator, Component, Graphics, Node } from 'cc';
import { gameStore } from '../state/gameStore';
import { drawGridBg } from './LayerRenderer';
import { PlacedPiece } from './PlacedPiece';
const { ccclass, property } = _decorator;

@ccclass('FloorPlan')
export class FloorPlan extends Component {
  @property(Node) gridBg!: Node;
  @property(Node) placedLayer!: Node;

  private unsub?: () => void;

  start() {
    this.renderAll();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.scenario !== prev.scenario) this.renderAll();
      if (s.placedPieces !== prev.placedPieces) this.rebuildPlacedLayer();
    });
  }

  onDestroy() { this.unsub?.(); }

  private renderAll() {
    const s = gameStore.getState();
    if (!s.scenario) return;
    const g = this.gridBg?.getComponent(Graphics);
    if (g) drawGridBg(g, s.scenario);
    this.rebuildPlacedLayer();
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
}
