import { _decorator, Component, Label } from 'cc';
import { gameStore } from '../state/gameStore';
const { ccclass, property } = _decorator;

@ccclass('ErrorToast')
export class ErrorToast extends Component {
  @property(Label) text!: Label;
  private unsub?: () => void;

  start() {
    if (this.node) this.node.active = false;
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.lastError && s.lastError !== prev.lastError) this.show(s.lastError);
    });
  }

  onDestroy() { this.unsub?.(); }

  private show(msg: string) {
    if (!this.text || !this.node) return;
    this.text.string = msg;
    this.node.active = true;
    this.scheduleOnce(() => {
      if (this.node) this.node.active = false;
      gameStore.getState().setError(null);
    }, 3);
  }
}
