import { _decorator, Component, Label, Button, Node } from 'cc';
import { gameStore } from '../state/gameStore';
import { InputHandler } from './InputHandler';
import { styleButton } from './StyledButton';
const { ccclass, property } = _decorator;

@ccclass('SelectionStatus')
export class SelectionStatus extends Component {
  @property(Label) statusLabel!: Label;
  @property(Button) rotateBtn!: Button;
  @property(Button) mirrorBtn!: Button;
  @property(Button) cancelBtn!: Button;
  @property(Button) placeBtn!: Button;
  @property(InputHandler) inputHandler!: InputHandler;

  private unsub?: () => void;

  start() {
    if (this.rotateBtn) this.rotateBtn.node.on(Button.EventType.CLICK, () => gameStore.getState().rotateSelection());
    if (this.mirrorBtn) this.mirrorBtn.node.on(Button.EventType.CLICK, () => gameStore.getState().mirrorSelection());
    if (this.cancelBtn) this.cancelBtn.node.on(Button.EventType.CLICK, () => gameStore.getState().clearSelection());
    if (this.placeBtn)  this.placeBtn.node.on(Button.EventType.CLICK,  () => this.inputHandler?.tryPlaceAtGhost());
    [this.rotateBtn, this.mirrorBtn, this.cancelBtn, this.placeBtn].forEach(styleButton);
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
    if (this.placeBtn)  this.placeBtn.interactable  = hasSel;
    if (this.mirrorBtn) {
      this.mirrorBtn.interactable = hasSel && !(s.jokerUsed && !sel!.mirrored);
    }

    if (!this.statusLabel) return;
    if (s.lastError) {
      this.statusLabel.string = `⚠ ${s.lastError}`;
      return;
    }
    if (sel) {
      this.statusLabel.string = `已选 #${sel.number}${sel.variant} 选项${sel.optionIndex} 旋转${sel.rotation * 90}°${sel.mirrored ? ' 镜像' : ''}`;
      return;
    }
    this.statusLabel.string = '点卡片 → 点选项';
  }
}
