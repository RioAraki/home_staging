import { _decorator, Component, Label, Button, Node } from 'cc';
import { gameStore, currentCard } from '../state/gameStore';
import { InputHandler } from './InputHandler';
import { styleButton } from './StyledButton';
const { ccclass, property } = _decorator;

/**
 * Bottom action bar for the sequential placement flow.
 * Buttons repurposed (no new scene nodes):
 *   placeBtn  → 确定 (commit the ghost via InputHandler.tryPlaceAtGhost)
 *   cancelBtn → 跳过 (skip the current card → next card)
 *   mirrorBtn → 镜像 (joker, once per game)
 *   rotateBtn → hidden (rotation is now a swipe in the chooser)
 */
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
    // Rotation moved to swipe — hide the old rotate button.
    if (this.rotateBtn) this.rotateBtn.node.active = false;

    if (this.mirrorBtn) {
      this.mirrorBtn.node.on(Button.EventType.CLICK, () => gameStore.getState().mirrorSelection());
      setBtnLabel(this.mirrorBtn, '镜像');
    }
    if (this.cancelBtn) {
      this.cancelBtn.node.on(Button.EventType.CLICK, () => {
        const card = currentCard(gameStore.getState());
        if (card) gameStore.getState().skipCard(card.slot, card.slotIdx);
      });
      setBtnLabel(this.cancelBtn, '跳过');
    }
    if (this.placeBtn) {
      this.placeBtn.node.on(Button.EventType.CLICK, () => this.inputHandler?.tryPlaceAtGhost());
      setBtnLabel(this.placeBtn, '确定');
    }
    [this.mirrorBtn, this.cancelBtn, this.placeBtn].forEach(styleButton);
    this.refresh();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.selectedOption  !== prev.selectedOption  ||
          s.lastError       !== prev.lastError       ||
          s.jokerUsed       !== prev.jokerUsed       ||
          s.activeRoomSlot  !== prev.activeRoomSlot  ||
          s.placedCardKeys  !== prev.placedCardKeys  ||
          s.skippedCardKeys !== prev.skippedCardKeys) {
        this.refresh();
      }
    });
  }

  onDestroy() { this.unsub?.(); }

  private refresh() {
    const s = gameStore.getState();
    const sel = s.selectedOption;
    const card = currentCard(s);
    const hasSel = !!sel;

    if (this.placeBtn)  this.placeBtn.interactable  = hasSel;
    if (this.cancelBtn) this.cancelBtn.interactable  = !!card;   // skip available while a card is showing
    if (this.mirrorBtn) {
      this.mirrorBtn.interactable = hasSel && !(s.jokerUsed && !sel!.mirrored);
    }

    if (!this.statusLabel) return;
    if (s.lastError) {
      this.statusLabel.string = `⚠ ${s.lastError}`;
      return;
    }
    // Keep these short: the label box is wide and centered, so long strings
    // spread right into the mirror/skip/confirm buttons.
    if (sel) {
      this.statusLabel.string = `选项${sel.optionIndex} ${sel.rotation * 90}°${sel.mirrored ? ' 镜像' : ''}`;
      return;
    }
    if (card) {
      this.statusLabel.string = '点家具→滑动旋转→确定';
      return;
    }
    this.statusLabel.string = '家具摆完，去造墙/门';
  }
}

/** Set the text of a Button's first descendant Label. */
function setBtnLabel(btn: Button, text: string) {
  const label = btn.node.getComponentInChildren(Label);
  if (label) label.string = text;
}
