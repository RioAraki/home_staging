import { _decorator, Component, Label, UITransform, Widget, Color, Graphics, Node } from 'cc';
import { gameStore } from '../state/gameStore';
const { ccclass, property } = _decorator;

@ccclass('ErrorToast')
export class ErrorToast extends Component {
  @property(Label) text!: Label;
  private unsub?: () => void;
  private hideCb?: () => void;

  start() {
    if (this.node) this.node.active = false;

    // Pin to bottom-center so it appears in the same area as RoomPanel hints,
    // overriding whatever position the scene file stored.
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setContentSize(500, 48);
    ui.setAnchorPoint(0.5, 0);
    const widget = this.node.addComponent(Widget);
    widget.isAlignBottom = true;
    widget.isAlignHorizontalCenter = true;
    widget.bottom = 120;  // sit just above the action-button row
    widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

    // Draw a rounded background so the text is legible over the floor plan.
    if (!this.node.getChildByName('toastBg')) {
      const bg = new Node('toastBg');
      this.node.addChild(bg);
      bg.setPosition(0, 24, 0);
      bg.addComponent(UITransform).setContentSize(500, 48);
      const g = bg.addComponent(Graphics);
      g.fillColor = new Color(20, 10, 10, 210);
      g.strokeColor = new Color(240, 100, 80, 180);
      g.lineWidth = 1.2;
      g.roundRect(-250, 0, 500, 48, 8);
      g.fill();
      g.stroke();
    }

    if (this.text) {
      this.text.fontSize = 18;
      this.text.color    = new Color(255, 200, 190, 255);
      this.text.enableWrapText  = false;
      this.text.overflow        = (Label as any).Overflow?.SHRINK ?? 2;
      const lblUi = this.text.node.getComponent(UITransform)
                 ?? this.text.node.addComponent(UITransform);
      lblUi.setContentSize(480, 40);
    }

    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.lastError && s.lastError !== prev.lastError) this.show(s.lastError);
    });
  }

  onDestroy() { this.unsub?.(); }

  private show(msg: string) {
    if (!this.text || !this.node) return;
    this.text.string = msg;
    this.node.active = true;
    // Cancel the previous timer: otherwise an earlier toast's pending hide
    // fires early on this one (deactivating the node only PAUSES the timer,
    // so it would also resume and fire almost immediately on the next show).
    if (this.hideCb) this.unschedule(this.hideCb);
    this.hideCb = () => {
      if (this.node) this.node.active = false;
      gameStore.getState().setError(null);
    };
    this.scheduleOnce(this.hideCb, 3);
  }
}
