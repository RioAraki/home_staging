import { _decorator, Component, Node, UITransform, Graphics, Label, Color, Widget } from 'cc';
import { gameStore } from '../state/gameStore';
const { ccclass } = _decorator;

const BTN_W = 150;
const BTN_H = 44;
const GAP = 10;

/**
 * Persistent top-right overlay with two toggles: 背景音乐 (BGM) and 音效 (SFX).
 * Tapping a button mutes/unmutes that channel via the store (which also
 * persists the choice through audioSettings). Built entirely in code and
 * mounted under the Canvas at runtime (see GameBootstrap) so it needs no
 * scene wiring.
 */
@ccclass('AudioControls')
export class AudioControls extends Component {
  private bgmLabel?: Label;
  private bgmBg?: Graphics;
  private sfxLabel?: Label;
  private sfxBg?: Graphics;
  private unsub?: () => void;

  start() {
    // Anchor the container to the top-right corner of the Canvas.
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setAnchorPoint(1, 1);
    ui.setContentSize(BTN_W, BTN_H * 2 + GAP);
    const widget = this.node.addComponent(Widget);
    widget.isAlignBottom = true;
    widget.isAlignRight  = true;
    widget.bottom = 12;
    widget.right  = 12;
    widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

    // Two stacked buttons; (0,0) is the node's top-right corner (anchor 1,1),
    // so children sit at negative x/y.
    const b1 = this.makeButton(-BTN_W / 2, -BTN_H / 2, () => {
      const s = gameStore.getState();
      s.setBgmMuted(!s.bgmMuted);
    });
    this.bgmBg = b1.bg; this.bgmLabel = b1.label;

    const b2 = this.makeButton(-BTN_W / 2, -BTN_H / 2 - BTN_H - GAP, () => {
      const s = gameStore.getState();
      s.setSfxMuted(!s.sfxMuted);
    });
    this.sfxBg = b2.bg; this.sfxLabel = b2.label;

    this.refresh();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.bgmMuted !== prev.bgmMuted || s.sfxMuted !== prev.sfxMuted) this.refresh();
    });
  }

  onDestroy() { this.unsub?.(); }

  private makeButton(x: number, y: number, onTap: () => void): { bg: Graphics; label: Label } {
    const node = new Node('audioBtn');
    this.node.addChild(node);
    node.setPosition(x, y, 0);
    node.addComponent(UITransform).setContentSize(BTN_W, BTN_H);

    const bg = node.addComponent(Graphics);

    const lblNode = new Node('label');
    node.addChild(lblNode);
    const label = lblNode.addComponent(Label);
    label.fontSize = 22;
    label.color = new Color(255, 255, 255, 255);
    label.enableOutline = true;
    label.outlineColor = new Color(0, 0, 0, 200);
    label.outlineWidth = 2;

    node.on(Node.EventType.TOUCH_END, onTap);
    return { bg, label };
  }

  private refresh() {
    const s = gameStore.getState();
    this.paint(this.bgmBg, this.bgmLabel, '背景音乐', s.bgmMuted);
    this.paint(this.sfxBg, this.sfxLabel, '音效', s.sfxMuted);
  }

  /** Green "开" when on, grey "关" when muted. */
  private paint(bg: Graphics | undefined, label: Label | undefined, name: string, muted: boolean) {
    if (label) label.string = `${name} ${muted ? '关' : '开'}`;
    if (!bg) return;
    bg.clear();
    bg.fillColor = muted ? new Color(120, 120, 130, 255) : new Color(80, 160, 90, 255);
    bg.roundRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, 10);
    bg.fill();
  }
}
