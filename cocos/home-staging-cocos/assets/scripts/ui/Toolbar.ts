import { _decorator, Component, Label, Button } from 'cc';
import { gameStore } from '../state/gameStore';
const { ccclass, property } = _decorator;

@ccclass('Toolbar')
export class Toolbar extends Component {
  @property(Button) phaseBtn!: Button;
  @property(Label)  phaseLabel!: Label;
  @property(Button) completeBtn!: Button;

  private unsub?: () => void;

  start() {
    if (this.phaseBtn) {
      this.phaseBtn.node.on(Button.EventType.CLICK, () => {
        const s = gameStore.getState();
        s.setWallPhase(s.wallPhase === 'walls' ? 'door' : 'walls');
      });
    }
    if (this.completeBtn) {
      this.completeBtn.node.on(Button.EventType.CLICK, () => gameStore.getState().completeRoom());
    }
    this.refresh();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.wallPhase !== prev.wallPhase) this.refresh();
    });
  }

  onDestroy() { this.unsub?.(); }

  private refresh() {
    if (!this.phaseLabel) return;
    const s = gameStore.getState();
    this.phaseLabel.string = s.wallPhase === 'walls' ? 'walls (-> door)' : 'door (-> walls)';
  }
}
