import { _decorator, Component, Label, Button, Node } from 'cc';
import { gameStore } from '../state/gameStore';
const { ccclass, property } = _decorator;

@ccclass('SelectionStatus')
export class SelectionStatus extends Component {
  @property(Label) statusLabel!: Label;
  @property(Button) rotateBtn!: Button;
  @property(Button) mirrorBtn!: Button;
  @property(Button) cancelBtn!: Button;

  private unsub?: () => void;

  start() {
    if (this.rotateBtn) this.rotateBtn.node.on(Button.EventType.CLICK, () => gameStore.getState().rotateSelection());
    if (this.mirrorBtn) this.mirrorBtn.node.on(Button.EventType.CLICK, () => gameStore.getState().mirrorSelection());
    if (this.cancelBtn) this.cancelBtn.node.on(Button.EventType.CLICK, () => gameStore.getState().clearSelection());
    this.refresh();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.selectedOption !== prev.selectedOption ||
          s.lastError      !== prev.lastError      ||
          s.jokerUsed      !== prev.jokerUsed) {
        this.refresh();
      }
    });
  }

  onDestroy() { this.unsub?.(); }

  private refresh() {
    const s = gameStore.getState();
    const sel = s.selectedOption;
    const hasSel = !!sel;

    if (this.rotateBtn) this.rotateBtn.interactable = hasSel;
    if (this.cancelBtn) this.cancelBtn.interactable = hasSel;
    if (this.mirrorBtn) {
      // Mirror disabled if joker already burned AND current selection isn't mirrored
      this.mirrorBtn.interactable = hasSel && !(s.jokerUsed && !sel!.mirrored);
    }

    if (!this.statusLabel) return;
    if (s.lastError) {
      this.statusLabel.string = `! ${s.lastError}`;
      return;
    }
    if (sel) {
      this.statusLabel.string = `#${sel.number}${sel.variant} opt${sel.optionIndex} rot${sel.rotation}${sel.mirrored ? ' M' : ''}`;
      return;
    }
    this.statusLabel.string = 'Tap a card -> tap an option';
  }
}
