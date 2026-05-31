import { _decorator, Component, Label } from 'cc';
import { gameStore } from '../state/gameStore';
const { ccclass, property } = _decorator;

@ccclass('SelectionStatus')
export class SelectionStatus extends Component {
  @property(Label) statusLabel!: Label;

  private unsub?: () => void;

  start() {
    this.refresh();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.selectedOption !== prev.selectedOption ||
          s.lastError      !== prev.lastError) {
        this.refresh();
      }
    });
  }

  onDestroy() { this.unsub?.(); }

  private refresh() {
    if (!this.statusLabel) return;
    const s = gameStore.getState();
    if (s.lastError) {
      this.statusLabel.string = `! ${s.lastError}`;
      return;
    }
    if (s.selectedOption) {
      const o = s.selectedOption;
      this.statusLabel.string = `Selected #${o.number}${o.variant} opt${o.optionIndex} rot${o.rotation}${o.mirrored ? ' M' : ''}`;
      return;
    }
    this.statusLabel.string = 'Tap a card -> tap an option';
  }
}
