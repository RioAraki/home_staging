import { _decorator, Component, Label } from 'cc';
import { gameStore } from '../state/gameStore';
import { computeScore } from '../core/scoring';
const { ccclass, property } = _decorator;

@ccclass('BonusPanel')
export class BonusPanel extends Component {
  @property(Label) summaryLabel!: Label;

  private unsub?: () => void;

  start() {
    this.refresh();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.placedPieces       !== prev.placedPieces      ||
          s.completedRoomSlots !== prev.completedRoomSlots ||
          s.walls              !== prev.walls              ||
          s.doors              !== prev.doors              ||
          s.windows            !== prev.windows            ||
          s.frontDoorEdge      !== prev.frontDoorEdge) {
        this.refresh();
      }
    });
  }

  onDestroy() { this.unsub?.(); }

  private refresh() {
    if (!this.summaryLabel) return;
    const s = gameStore.getState();
    if (!s.scenario) { this.summaryLabel.string = ''; return; }
    try {
      const result = computeScore(
        s.scenario,
        s.placedPieces,
        s.walls,
        s.doors,
        s.frontDoorEdge,
        s.windows,
      );
      this.summaryLabel.string = `总分: ${result.total}`;
    } catch (e) {
      this.summaryLabel.string = `总分: ?`;
    }
  }
}
