import { _decorator, Component, Graphics, Node } from 'cc';
import { gameStore } from '../state/gameStore';
import { drawGridBg } from './LayerRenderer';
const { ccclass, property } = _decorator;

@ccclass('FloorPlan')
export class FloorPlan extends Component {
  @property(Node) gridBg!: Node;

  private unsub?: () => void;

  start() {
    this.renderAll();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.scenario !== prev.scenario) this.renderAll();
    });
  }

  onDestroy() { this.unsub?.(); }

  private renderAll() {
    const s = gameStore.getState();
    if (!s.scenario) return;
    const g = this.gridBg.getComponent(Graphics);
    if (g) drawGridBg(g, s.scenario);
  }
}
