import { _decorator, Component, Label, Button, Color } from 'cc';
import { gameStore, getRoomPhase } from '../state/gameStore';
import { styleButton } from './StyledButton';
const { ccclass, property } = _decorator;

@ccclass('Toolbar')
export class Toolbar extends Component {
  @property(Button) phaseBtn!: Button;
  @property(Label)  phaseLabel!: Label;
  @property(Button) completeBtn!: Button;
  @property(Button) frontDoorBtn!: Button;
  @property(Button) windowBtn!: Button;
  @property(Button) demolishBtn!: Button;
  @property(Button) finishBtn!: Button;
  @property(Button) undoBtn!: Button;

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
    if (this.finishBtn)    this.finishBtn.node.on(Button.EventType.CLICK,    () => gameStore.getState().finishGame());
    if (this.undoBtn) this.undoBtn.node.on(Button.EventType.CLICK, () => gameStore.getState().undo());
    // Paint styled rounded-rect backgrounds on every button
    [this.phaseBtn, this.completeBtn, this.frontDoorBtn, this.windowBtn,
     this.demolishBtn, this.finishBtn, this.undoBtn].forEach(styleButton);
    this.refresh();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.wallPhase       !== prev.wallPhase ||
          s.frontDoorMode   !== prev.frontDoorMode ||
          s.windowMode      !== prev.windowMode ||
          s.demolishMode    !== prev.demolishMode ||
          s.activeRoomSlot  !== prev.activeRoomSlot ||
          s.placedCardKeys  !== prev.placedCardKeys ||
          s.skippedCardKeys !== prev.skippedCardKeys ||
          s.past            !== prev.past) this.refresh();
    });
  }

  onDestroy() { this.unsub?.(); }

  private refresh() {
    if (!this.phaseLabel) return;
    const s = gameStore.getState();
    // Construction tools (walls/doors/windows/front-door/demolish/complete) are
    // locked until the active room's furniture is all placed or skipped.
    const construction = getRoomPhase(s) === 'construction';
    this.phaseLabel.string = !construction
      ? '先摆完家具'
      : (s.wallPhase === 'walls' ? '画墙 (→ 门)' : '放门 (→ 墙)');

    const setEnabled = (b: Button | null | undefined, enabled: boolean) => {
      if (!b) return;
      b.interactable = enabled;
      const sprite = b.node.getComponent('cc.Sprite' as any) as any;
      if (sprite && sprite.color !== undefined) {
        sprite.color = enabled ? new Color(255, 255, 255, 255) : new Color(150, 150, 150, 150);
      }
    };
    // Lock all construction buttons during the furniture phase.
    [this.phaseBtn, this.completeBtn, this.frontDoorBtn, this.windowBtn, this.demolishBtn]
      .forEach((b) => setEnabled(b, construction));

    // Active-mode highlight (only meaningful in construction phase).
    const dim = (b: Button | null | undefined, active: boolean) => {
      if (!b || !b.interactable) return;
      const sprite = b.node.getComponent('cc.Sprite' as any) as any;
      if (sprite && sprite.color !== undefined) {
        sprite.color = active ? new Color(100, 100, 100, 255) : new Color(255, 255, 255, 255);
      }
    };
    if (construction) {
      dim(this.frontDoorBtn, s.frontDoorMode);
      dim(this.windowBtn,    s.windowMode);
      dim(this.demolishBtn,  s.demolishMode);
    }
    if (this.undoBtn) this.undoBtn.interactable = s.past.length > 0;
  }
}
