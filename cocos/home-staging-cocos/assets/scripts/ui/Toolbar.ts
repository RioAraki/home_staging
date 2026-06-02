import { _decorator, Component, Label, Button, Color, UITransform, Sprite } from 'cc';
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
    // No "finish/settle" button anymore — the game auto-settles when the last
    // room is sealed (see gameStore.completeRoom).
    if (this.finishBtn) this.finishBtn.node.active = false;
    if (this.undoBtn) this.undoBtn.node.on(Button.EventType.CLICK, () => gameStore.getState().undo());

    // Paint styled rounded-rect backgrounds.
    [this.phaseBtn, this.completeBtn, this.frontDoorBtn, this.windowBtn, this.demolishBtn]
      .forEach((b) => styleButton(b));

    // Undo: styled like the place button but red, and enlarged to match.
    if (this.undoBtn) {
      // The scene Button has its own dark background Sprite that draws at its
      // own frame size (peeking out behind our resized red rect) — disable it
      // and turn off sprite transitions so only the red Graphics shows.
      const sp = this.undoBtn.node.getComponent(Sprite);
      if (sp) sp.enabled = false;
      this.undoBtn.transition = Button.Transition.NONE;
      const ui = this.undoBtn.node.getComponent(UITransform) ?? this.undoBtn.node.addComponent(UITransform);
      ui.setContentSize(120, 60);
      styleButton(this.undoBtn, new Color(200, 70, 60, 255), new Color(120, 30, 25, 255));
      const lbl = this.undoBtn.node.getComponentInChildren(Label);
      if (lbl) { lbl.color = new Color(255, 255, 255, 255); lbl.string = '撤销'; }
    }
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
    const s = gameStore.getState();
    // Construction tools stay HIDDEN during the furniture phase to keep the
    // top bar clean; they appear only once the room's furniture is done.
    const construction = getRoomPhase(s) === 'construction';

    const show = (b: Button | null | undefined, visible: boolean) => {
      if (b) b.node.active = visible;
    };
    [this.phaseBtn, this.completeBtn, this.frontDoorBtn, this.windowBtn, this.demolishBtn]
      .forEach((b) => show(b, construction));
    if (this.phaseLabel) this.phaseLabel.node.active = construction;

    if (this.phaseLabel && construction) {
      this.phaseLabel.string = s.wallPhase === 'walls' ? '画墙 (→ 门)' : '放门 (→ 墙)';
    }

    // Active-mode highlight (construction phase only).
    const dim = (b: Button | null | undefined, active: boolean) => {
      if (!b) return;
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
