import { _decorator, Component, Node, UITransform, Graphics, Label, Color, Widget, director, Canvas } from 'cc';
import { gameStore } from '../state/gameStore';
const { ccclass } = _decorator;

const GEAR_SZE = 52;   // gear button size
const CARD_W   = 360;
const ROW_H    = 64;
const PAD      = 24;
const TOGGLE_W = 110;
const TOGGLE_H = 44;

/**
 * Compact settings entry: a single gear button in the top-right corner.
 * Tapping it opens a modal panel with 背景音乐 (BGM) and 音效 (SFX) toggles.
 * Built entirely in code and mounted under the Canvas at runtime (see
 * GameBootstrap) so it needs no scene wiring.
 */
@ccclass('AudioControls')
export class AudioControls extends Component {
  private popup: Node | null = null;
  private unsub?: () => void;

  start() {
    // Gear button anchored to the top-right corner of the Canvas.
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setAnchorPoint(1, 1);
    ui.setContentSize(GEAR_SZE, GEAR_SZE);
    const widget = this.node.addComponent(Widget);
    widget.isAlignTop   = true;
    widget.isAlignRight = true;
    widget.top   = 10;
    widget.right = 12;
    widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

    // Round gear button (centred under the node's top-right anchor).
    const btn = new Node('gearBtn');
    this.node.addChild(btn);
    btn.setPosition(-GEAR_SZE / 2, -GEAR_SZE / 2, 0);
    btn.addComponent(UITransform).setContentSize(GEAR_SZE, GEAR_SZE);
    const g = btn.addComponent(Graphics);
    g.fillColor   = new Color(20, 36, 64, 220);
    g.strokeColor = new Color(255, 255, 255, 60);
    g.lineWidth   = 1.5;
    g.circle(0, 0, GEAR_SZE / 2);
    g.fill();
    g.stroke();
    const lblNode = new Node('gearLbl');
    btn.addChild(lblNode);
    const lbl = lblNode.addComponent(Label);
    lbl.string   = '⚙';
    lbl.fontSize = 30;
    lbl.color    = new Color(255, 255, 255, 255);

    btn.on(Node.EventType.TOUCH_END, () => this.togglePopup());

    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.bgmMuted !== prev.bgmMuted || s.sfxMuted !== prev.sfxMuted) {
        if (this.popup) this.buildPopupContent();   // refresh toggle labels
      }
    });
  }

  onDestroy() { this.unsub?.(); }

  private togglePopup() {
    if (this.popup) { this.closePopup(); return; }
    this.openPopup();
  }

  private closePopup() {
    this.popup?.destroy();
    this.popup = null;
  }

  private openPopup() {
    const canvas = director.getScene()?.getComponentInChildren(Canvas);
    if (!canvas) return;

    const overlay = new Node('SettingsOverlay');
    canvas.node.addChild(overlay);
    this.popup = overlay;

    const canvasUi = canvas.node.getComponent(UITransform);
    const CW = canvasUi?.contentSize.width  ?? 750;
    const CH = canvasUi?.contentSize.height ?? 1334;
    overlay.addComponent(UITransform).setContentSize(CW, CH);

    // Dim background — tap anywhere outside the card closes the popup.
    const dim = overlay.addComponent(Graphics);
    dim.fillColor = new Color(0, 0, 0, 170);
    dim.rect(-CW / 2, -CH / 2, CW, CH);
    dim.fill();
    overlay.on(Node.EventType.TOUCH_END, () => this.closePopup());

    this.buildPopupContent();
  }

  /** (Re)build the settings card inside the overlay. */
  private buildPopupContent() {
    if (!this.popup) return;
    // Remove any prior card so a refresh redraws cleanly.
    this.popup.getChildByName('card')?.destroy();

    const cardH = PAD + 50 + ROW_H * 2 + PAD;
    const card = new Node('card');
    this.popup.addChild(card);
    card.setPosition(0, 0, 0);
    card.addComponent(UITransform).setContentSize(CARD_W, cardH);
    // Swallow taps on the card so they don't bubble to the dim-close handler.
    card.on(Node.EventType.TOUCH_END, (e: any) => e.propagationStopped = true);

    const cg = card.addComponent(Graphics);
    cg.fillColor   = new Color(16, 30, 56, 252);
    cg.strokeColor = new Color(255, 255, 255, 45);
    cg.lineWidth   = 1.5;
    cg.roundRect(-CARD_W / 2, -cardH / 2, CARD_W, cardH, 16);
    cg.fill();
    cg.stroke();

    // Title "设置"
    const titleNode = new Node('title');
    card.addChild(titleNode);
    titleNode.setPosition(0, cardH / 2 - PAD - 12, 0);
    const titleLbl = titleNode.addComponent(Label);
    titleLbl.string   = '设置';
    titleLbl.fontSize = 26;
    titleLbl.isBold   = true;
    titleLbl.color    = new Color(255, 225, 105, 255);

    const s = gameStore.getState();
    const firstRowY = cardH / 2 - PAD - 50 - ROW_H / 2;
    this.makeToggleRow('背景音乐', !s.bgmMuted, firstRowY, card,
      () => gameStore.getState().setBgmMuted(!gameStore.getState().bgmMuted));
    this.makeToggleRow('音效', !s.sfxMuted, firstRowY - ROW_H, card,
      () => gameStore.getState().setSfxMuted(!gameStore.getState().sfxMuted));
  }

  private makeToggleRow(name: string, on: boolean, y: number, parent: Node, onTap: () => void) {
    // Label on the left.
    const nameNode = new Node('name');
    parent.addChild(nameNode);
    nameNode.setPosition(-CARD_W / 2 + PAD, y, 0);
    nameNode.addComponent(UITransform).setAnchorPoint(0, 0.5);
    const nameLbl = nameNode.addComponent(Label);
    nameLbl.string   = name;
    nameLbl.fontSize = 22;
    nameLbl.color    = new Color(235, 240, 250, 255);
    nameLbl.horizontalAlign = (Label as any).HorizontalAlign?.LEFT ?? 0;

    // Toggle pill on the right.
    const toggle = new Node('toggle');
    parent.addChild(toggle);
    toggle.setPosition(CARD_W / 2 - PAD - TOGGLE_W / 2, y, 0);
    toggle.addComponent(UITransform).setContentSize(TOGGLE_W, TOGGLE_H);
    const tg = toggle.addComponent(Graphics);
    tg.fillColor = on ? new Color(80, 160, 90, 255) : new Color(110, 115, 128, 255);
    tg.roundRect(-TOGGLE_W / 2, -TOGGLE_H / 2, TOGGLE_W, TOGGLE_H, 10);
    tg.fill();
    const tLblNode = new Node('tlbl');
    toggle.addChild(tLblNode);
    const tLbl = tLblNode.addComponent(Label);
    tLbl.string   = on ? '开' : '关';
    tLbl.fontSize = 22;
    tLbl.isBold   = true;
    tLbl.color    = new Color(255, 255, 255, 255);

    toggle.on(Node.EventType.TOUCH_END, (e: any) => {
      e.propagationStopped = true;
      onTap();   // store change triggers subscribe → buildPopupContent refresh
    });
  }
}
