import { _decorator, Component, Label } from 'cc';
import { gameStore } from '../state/gameStore';
const { ccclass, property } = _decorator;

@ccclass('WallModeBanner')
export class WallModeBanner extends Component {
  @property(Label) label!: Label;

  private unsub?: () => void;

  start() {
    this.refresh();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.frontDoorMode !== prev.frontDoorMode ||
          s.windowMode    !== prev.windowMode    ||
          s.demolishMode  !== prev.demolishMode) {
        this.refresh();
      }
    });
  }
  onDestroy() { this.unsub?.(); }

  private refresh() {
    const s = gameStore.getState();
    if (s.frontDoorMode) this.set('Tap an exterior edge to set front door');
    else if (s.windowMode) this.set('Tap an exterior edge to add/remove a window');
    else if (s.demolishMode) this.set('Tap a piece or wall/door/window to demolish');
    else if (this.node) this.node.active = false;
  }
  private set(text: string) {
    if (this.label) this.label.string = text;
    if (this.node) this.node.active = true;
  }
}
