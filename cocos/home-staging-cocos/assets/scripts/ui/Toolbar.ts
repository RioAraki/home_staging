import { _decorator, Component, Label, Button, Color } from 'cc';
import { gameStore } from '../state/gameStore';
const { ccclass, property } = _decorator;

@ccclass('Toolbar')
export class Toolbar extends Component {
  @property(Button) phaseBtn!: Button;
  @property(Label)  phaseLabel!: Label;
  @property(Button) completeBtn!: Button;
  @property(Button) frontDoorBtn!: Button;
  @property(Button) windowBtn!: Button;
  @property(Button) demolishBtn!: Button;

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
    if (this.frontDoorBtn) this.frontDoorBtn.node.on(Button.EventType.CLICK, () => gameStore.getState().toggleFrontDoorMode());
    if (this.windowBtn)    this.windowBtn.node.on(Button.EventType.CLICK,    () => gameStore.getState().toggleWindowMode());
    if (this.demolishBtn)  this.demolishBtn.node.on(Button.EventType.CLICK,  () => gameStore.getState().toggleDemolishMode());
    this.refresh();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.wallPhase !== prev.wallPhase ||
          s.frontDoorMode !== prev.frontDoorMode ||
          s.windowMode    !== prev.windowMode ||
          s.demolishMode  !== prev.demolishMode) this.refresh();
    });
  }

  onDestroy() { this.unsub?.(); }

  private refresh() {
    if (!this.phaseLabel) return;
    const s = gameStore.getState();
    this.phaseLabel.string = s.wallPhase === 'walls' ? 'walls (-> door)' : 'door (-> walls)';
    const dim = (b: Button | null | undefined, active: boolean) => {
      if (!b) return;
      const sprite = b.node.getComponent('cc.Sprite' as any) as any;
      if (sprite && sprite.color !== undefined) {
        sprite.color = active ? new Color(100, 100, 100, 255) : new Color(255, 255, 255, 255);
      }
    };
    dim(this.frontDoorBtn, s.frontDoorMode);
    dim(this.windowBtn,    s.windowMode);
    dim(this.demolishBtn,  s.demolishMode);
  }
}
