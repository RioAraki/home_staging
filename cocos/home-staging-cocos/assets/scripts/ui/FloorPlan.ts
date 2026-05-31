import { _decorator, Component, Graphics, Node } from 'cc';
import { gameStore } from '../state/gameStore';
import { drawGridBg, drawWalls, drawDoors, drawWindows } from './LayerRenderer';
import { PlacedPiece } from './PlacedPiece';
const { ccclass, property } = _decorator;

@ccclass('FloorPlan')
export class FloorPlan extends Component {
  @property(Node) gridBg!: Node;
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

  private renderAll() {
    const s = gameStore.getState();
    if (!s.scenario) return;
    const g = this.gridBg?.getComponent(Graphics);
    if (g) drawGridBg(g, s.scenario);
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
