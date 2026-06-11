import {
  _decorator, Component, Node, UITransform, Graphics, Label, Color,
  Widget, director, Canvas,
} from 'cc';
import type { Scenario } from '../core/types';
import { availableScenarios } from '../core/dataLoader';
import { gameStore } from '../state/gameStore';
const { ccclass } = _decorator;

// ── Layout ────────────────────────────────────────────────────────────────────
const BTN_SZE  = 52;    // back-to-select button (same size as the settings gear)
const CARD_W   = 520;
const PAD      = 28;
const TITLE_H  = 64;
const ROW_H    = 76;
const ROW_GAP  = 14;
const TAG_W    = 72;
const TAG_H    = 34;

// Confirm dialog
const CONF_W     = 400;
const CONF_BTN_W = 150;
const CONF_BTN_H = 50;

// Colours (mirroring EndGameScreen's palette)
const C_DIM    = new Color(6,   14,  30,  245);  // near-opaque: hides the board behind
const C_CARD   = new Color(12,  28,  55,  252);
const C_BORDER = new Color(255, 255, 255, 40);
const C_TITLE  = new Color(255, 225, 105, 255);
const C_WHITE  = new Color(255, 255, 255, 255);
const C_SOFT   = new Color(170, 175, 195, 255);
const C_ROW    = new Color(255, 255, 255, 14);
const C_ROW_BD = new Color(255, 255, 255, 36);
const C_BLUE   = new Color(60,  110, 200, 255);
const C_GREY   = new Color(110, 115, 128, 255);

const DIFF_ZH: Record<string, string> = {
  training: '训练', easy: '简单', medium: '中等', hard: '困难',
};
const DIFF_COLOR: Record<string, Color> = {
  training: new Color(90,  160, 240, 255),
  easy:     new Color(90,  210, 120, 255),
  medium:   new Color(255, 200, 90,  255),
  hard:     new Color(240, 110, 110, 255),
};
// ─────────────────────────────────────────────────────────────────────────────

let _instance: ScenarioSelectScreen | null = null;

/** Open the scenario-select overlay from anywhere (e.g. EndGameScreen). */
export function openScenarioSelect() {
  _instance?.show();
}

/** Start a run: initRun + auto-select the first room (the sequential card
 *  flow needs an active room — same bootstrap behaviour as before). */
export function startScenario(scenario: Scenario) {
  gameStore.getState().initRun(scenario);
  const firstRoom = scenario.rooms[0];
  if (firstRoom) gameStore.getState().selectRoom(firstRoom.slot);
}

/**
 * Scenario-select screen. Mounted under the Canvas by GameBootstrap; shows
 * itself immediately so booting the game lands on the select screen. Also
 * owns a small "☰" button (left of the settings gear) that returns to the
 * select screen mid-game, behind a confirm dialog (the run is discarded —
 * the game is stateless).
 */
@ccclass('ScenarioSelectScreen')
export class ScenarioSelectScreen extends Component {
  private overlay: Node | null = null;
  private confirm: Node | null = null;
  private backBtn: Node | null = null;

  start() {
    _instance = this;
    this.buildBackButton();
    this.show();   // boot lands on the select screen
  }

  onDestroy() {
    if (_instance === this) _instance = null;
    // Overlays are parented to the Canvas, not to this node — destroy them
    // explicitly or their touch handlers would outlive the component.
    this.overlay?.destroy();
    this.overlay = null;
    this.confirm?.destroy();
    this.confirm = null;
  }

  // ── Back-to-select button (visible during play, left of the gear) ────────
  private buildBackButton() {
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setAnchorPoint(1, 1);
    ui.setContentSize(BTN_SZE, BTN_SZE);
    const widget = this.node.addComponent(Widget);
    widget.isAlignTop   = true;
    widget.isAlignRight = true;
    widget.top   = 10;
    widget.right = 12 + BTN_SZE + 10;   // sits left of the settings gear
    widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

    const btn = new Node('backToSelectBtn');
    this.node.addChild(btn);
    this.backBtn = btn;
    btn.setPosition(-BTN_SZE / 2, -BTN_SZE / 2, 0);
    btn.addComponent(UITransform).setContentSize(BTN_SZE, BTN_SZE);
    const g = btn.addComponent(Graphics);
    g.fillColor   = new Color(20, 36, 64, 220);
    g.strokeColor = new Color(255, 255, 255, 60);
    g.lineWidth   = 1.5;
    g.circle(0, 0, BTN_SZE / 2);
    g.fill();
    g.stroke();
    const lblNode = new Node('lbl');
    btn.addChild(lblNode);
    const lbl = lblNode.addComponent(Label);
    lbl.string   = '☰';
    lbl.fontSize = 26;
    lbl.color    = C_WHITE;

    btn.on(Node.EventType.TOUCH_END, () => this.onBackTapped());
  }

  private onBackTapped() {
    const s = gameStore.getState();
    // Nothing to lose (no run, or run already settled) → no confirm needed.
    if (!s.scenario || s.gameFinished) { this.show(); return; }
    this.showConfirm();
  }

  // ── Confirm dialog (mid-game back) ────────────────────────────────────────
  private closeConfirm() {
    this.confirm?.destroy();
    this.confirm = null;
  }

  private showConfirm() {
    if (this.confirm) return;
    const canvas = director.getScene()?.getComponentInChildren(Canvas);
    if (!canvas) return;

    const overlay = new Node('BackConfirmOverlay');
    canvas.node.addChild(overlay);
    this.confirm = overlay;

    const canvasUi = canvas.node.getComponent(UITransform);
    const CW = canvasUi?.contentSize.width  ?? 750;
    const CH = canvasUi?.contentSize.height ?? 1334;
    overlay.addComponent(UITransform).setContentSize(CW, CH);
    const dim = overlay.addComponent(Graphics);
    dim.fillColor = new Color(0, 0, 0, 170);
    dim.rect(-CW / 2, -CH / 2, CW, CH);
    dim.fill();
    // Tap outside the card cancels.
    overlay.on(Node.EventType.TOUCH_END, () => this.closeConfirm());

    const confH = PAD + 44 + 36 + 20 + CONF_BTN_H + PAD;
    const card = new Node('card');
    overlay.addChild(card);
    card.addComponent(UITransform).setContentSize(CONF_W, confH);
    card.on(Node.EventType.TOUCH_END, (e: any) => e.propagationStopped = true);
    const cg = card.addComponent(Graphics);
    cg.fillColor   = C_CARD;
    cg.strokeColor = C_BORDER;
    cg.lineWidth   = 1.5;
    cg.roundRect(-CONF_W / 2, -confH / 2, CONF_W, confH, 16);
    cg.fill();
    cg.stroke();

    const titleNode = new Node('title');
    card.addChild(titleNode);
    titleNode.setPosition(0, confH / 2 - PAD - 22, 0);
    const titleLbl = titleNode.addComponent(Label);
    titleLbl.string   = '返回选关?';
    titleLbl.fontSize = 26;
    titleLbl.isBold   = true;
    titleLbl.color    = C_TITLE;

    const bodyNode = new Node('body');
    card.addChild(bodyNode);
    bodyNode.setPosition(0, confH / 2 - PAD - 44 - 18, 0);
    const bodyLbl = bodyNode.addComponent(Label);
    bodyLbl.string   = '当前关卡进度将丢失';
    bodyLbl.fontSize = 18;
    bodyLbl.color    = C_SOFT;

    const btnY = -confH / 2 + PAD + CONF_BTN_H / 2;
    const mkBtn = (text: string, x: number, fill: Color, onTap: () => void) => {
      const btn = new Node('btn');
      card.addChild(btn);
      btn.setPosition(x, btnY, 0);
      btn.addComponent(UITransform).setContentSize(CONF_BTN_W, CONF_BTN_H);
      const bg = btn.addComponent(Graphics);
      bg.fillColor = fill;
      bg.roundRect(-CONF_BTN_W / 2, -CONF_BTN_H / 2, CONF_BTN_W, CONF_BTN_H, 10);
      bg.fill();
      const ln = new Node('lbl');
      btn.addChild(ln);
      const l = ln.addComponent(Label);
      l.string   = text;
      l.fontSize = 20;
      l.color    = C_WHITE;
      btn.on(Node.EventType.TOUCH_END, (e: any) => {
        e.propagationStopped = true;
        onTap();
      });
    };
    const gap = (CONF_W - PAD * 2 - CONF_BTN_W * 2);
    mkBtn('取消', -(CONF_BTN_W + gap) / 2, C_GREY, () => this.closeConfirm());
    mkBtn('确认', (CONF_BTN_W + gap) / 2, C_BLUE, () => {
      this.closeConfirm();
      this.show();
    });
  }

  // ── Select overlay ────────────────────────────────────────────────────────
  hide() {
    this.overlay?.destroy();
    this.overlay = null;
    if (this.backBtn) this.backBtn.active = true;
  }

  show() {
    this.hide();
    const canvas = director.getScene()?.getComponentInChildren(Canvas);
    if (!canvas) return;
    if (this.backBtn) this.backBtn.active = false;   // overlay covers it anyway

    const overlay = new Node('ScenarioSelectOverlay');
    canvas.node.addChild(overlay);
    this.overlay = overlay;

    const canvasUi = canvas.node.getComponent(UITransform);
    const CW = canvasUi?.contentSize.width  ?? 750;
    const CH = canvasUi?.contentSize.height ?? 1334;
    overlay.addComponent(UITransform).setContentSize(CW, CH);
    const dim = overlay.addComponent(Graphics);
    dim.fillColor = C_DIM;
    dim.rect(-CW / 2, -CH / 2, CW, CH);
    dim.fill();
    // Swallow taps so nothing reaches the board underneath.
    overlay.on(Node.EventType.TOUCH_END, () => {});

    const list = availableScenarios();
    const cardH = PAD + TITLE_H + list.length * ROW_H
      + Math.max(0, list.length - 1) * ROW_GAP + PAD;

    const card = new Node('card');
    overlay.addChild(card);
    card.addComponent(UITransform).setContentSize(CARD_W, cardH);
    const cg = card.addComponent(Graphics);
    cg.fillColor   = C_CARD;
    cg.strokeColor = C_BORDER;
    cg.lineWidth   = 1.5;
    cg.roundRect(-CARD_W / 2, -cardH / 2, CARD_W, cardH, 16);
    cg.fill();
    cg.stroke();

    // Title
    const titleNode = new Node('title');
    card.addChild(titleNode);
    titleNode.setPosition(0, cardH / 2 - PAD - TITLE_H / 2 + 8, 0);
    const titleLbl = titleNode.addComponent(Label);
    titleLbl.string   = '选择关卡';
    titleLbl.fontSize = 30;
    titleLbl.isBold   = true;
    titleLbl.color    = C_TITLE;

    // Close button ("×", top-right) — only when a run is in progress, so the
    // player can back out of the list. At boot there is nothing to return to.
    if (gameStore.getState().scenario) {
      const close = new Node('close');
      card.addChild(close);
      close.setPosition(CARD_W / 2 - PAD - 6, cardH / 2 - PAD - 6, 0);
      close.addComponent(UITransform).setContentSize(48, 48);
      const xl = close.addComponent(Label);
      xl.string   = '×';
      xl.fontSize = 34;
      xl.color    = C_SOFT;
      close.on(Node.EventType.TOUCH_END, (e: any) => {
        e.propagationStopped = true;
        this.hide();
      });
    }

    // Scenario rows
    const ROW_W = CARD_W - PAD * 2;
    let y = cardH / 2 - PAD - TITLE_H - ROW_H / 2;
    for (const s of list) {
      this.buildRow(card, s, y, ROW_W);
      y -= ROW_H + ROW_GAP;
    }
  }

  private buildRow(parent: Node, scenario: Scenario, y: number, w: number) {
    const row = new Node(`row_${scenario.id}`);
    parent.addChild(row);
    row.setPosition(0, y, 0);
    row.addComponent(UITransform).setContentSize(w, ROW_H);

    const g = row.addComponent(Graphics);
    g.fillColor   = C_ROW;
    g.strokeColor = C_ROW_BD;
    g.lineWidth   = 1;
    g.roundRect(-w / 2, -ROW_H / 2, w, ROW_H, 12);
    g.fill();
    g.stroke();

    // Scenario title — left-aligned, capped so it never runs under the tag.
    const nameNode = new Node('name');
    row.addChild(nameNode);
    const nameUi = nameNode.addComponent(UITransform);
    nameUi.setContentSize(w - TAG_W - PAD * 2 - 8, ROW_H);
    nameUi.setAnchorPoint(0, 0.5);
    nameNode.setPosition(-w / 2 + PAD, 0, 0);
    const nameLbl = nameNode.addComponent(Label);
    nameLbl.string         = scenario.title_zh;
    nameLbl.fontSize       = 22;
    nameLbl.isBold         = true;
    nameLbl.color          = C_WHITE;
    nameLbl.enableWrapText = false;
    nameLbl.overflow       = (Label as any).Overflow?.SHRINK ?? 2;
    nameLbl.horizontalAlign = (Label as any).HorizontalAlign?.LEFT ?? 0;

    // Difficulty tag — right-aligned pill.
    const tag = new Node('tag');
    row.addChild(tag);
    tag.setPosition(w / 2 - PAD / 2 - TAG_W / 2 - 6, 0, 0);
    tag.addComponent(UITransform).setContentSize(TAG_W, TAG_H);
    const tagColor = DIFF_COLOR[scenario.difficulty] ?? C_SOFT;
    const tg = tag.addComponent(Graphics);
    tg.strokeColor = tagColor;
    tg.lineWidth   = 1.5;
    tg.roundRect(-TAG_W / 2, -TAG_H / 2, TAG_W, TAG_H, 8);
    tg.stroke();
    const tagLblNode = new Node('lbl');
    tag.addChild(tagLblNode);
    const tagLbl = tagLblNode.addComponent(Label);
    tagLbl.string   = DIFF_ZH[scenario.difficulty] ?? scenario.difficulty;
    tagLbl.fontSize = 17;
    tagLbl.color    = tagColor;

    row.on(Node.EventType.TOUCH_END, (e: any) => {
      e.propagationStopped = true;
      this.hide();
      startScenario(scenario);
    });
  }
}
