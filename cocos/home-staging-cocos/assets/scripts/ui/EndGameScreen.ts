import {
  _decorator, Component, Label, Button, Node, UITransform,
  Graphics, Color, Widget, director, Canvas,
} from 'cc';
import { gameStore } from '../state/gameStore';
import { computeScore } from '../core/scoring';
const { ccclass, property } = _decorator;

// ── Layout constants ──────────────────────────────────────────────────────────
const CARD_W   = 520;
const PAD      = 28;
const ROW_H    = 36;
const SEC_GAP  = 16;   // extra gap between sections
const TITLE_H  = 52;
const TOTAL_H  = 56;

// Colours
const C_BG_DIM  = new Color(0,   0,   0,   190);
const C_CARD    = new Color(12,  28,  55,  248);
const C_BORDER  = new Color(255, 255, 255, 45);
const C_TITLE   = new Color(255, 225, 105, 255);
const C_WHITE   = new Color(255, 255, 255, 255);
const C_SOFT    = new Color(180, 185, 200, 255);
const C_GREEN   = new Color(100, 220, 130, 255);
const C_GREY    = new Color(130, 135, 150, 255);
const C_DIVIDER = new Color(255, 255, 255, 30);
const C_TOTAL_BG = new Color(255, 225, 105, 30);
const C_TOTAL_BORDER = new Color(255, 225, 105, 80);
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full-screen score breakdown shown when the game is finished.
 * Replaces the old single-label overlay with a proper modal card:
 *
 *   ┌──────────────────────────────────┐
 *   │          最终得分                 │
 *   ├──────────────────────────────────┤
 *   │  房间得分                         │
 *   │  起居室  ████████  12 格          │
 *   │  厨房    ████      6 格           │
 *   │  浴室    ██████    8 格           │
 *   ├──────────────────────────────────┤
 *   │  奖励目标                         │
 *   │  ✓  +3  浴室完全装满…            │
 *   │  ✗  +2  围坐在一起…              │
 *   ├──────────────────────────────────┤
 *   │  总分   29                        │
 *   └──────────────────────────────────┘
 *              [再来一局]
 */
@ccclass('EndGameScreen')
export class EndGameScreen extends Component {
  // Scene-wired nodes kept for backward compat but hidden; layout is built in code.
  @property(Label)  detailLabel!: Label;
  @property(Button) closeBtn!: Button;

  private overlay: Node | null = null;
  private unsub?: () => void;

  start() {
    if (this.node) this.node.active = false;
    // Hide scene-side label/button — we rebuild in code.
    if (this.detailLabel) this.detailLabel.node.active = false;
    if (this.closeBtn)    this.closeBtn.node.active    = false;

    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.gameFinished !== prev.gameFinished) {
        if (s.gameFinished) this.show();
        else                this.hide();
      }
    });
  }

  onDestroy() { this.unsub?.(); }

  // ── Public ──────────────────────────────────────────────────────────────────

  private hide() {
    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
    }
    if (this.node) this.node.active = false;
  }

  private show() {
    this.hide();   // clean up any previous overlay

    const s = gameStore.getState();
    if (!s.scenario) return;

    let result;
    try {
      result = computeScore(
        s.scenario, s.placedPieces, s.walls,
        s.doors, s.frontDoorEdge, s.windows,
      );
    } catch { return; }

    // Mount on Canvas so it covers the entire screen.
    const canvas = director.getScene()?.getComponentInChildren(Canvas);
    if (!canvas) return;

    const overlay = new Node('EndGameOverlay');
    canvas.node.addChild(overlay);
    this.overlay = overlay;

    // Full-screen dim
    const dimUi = overlay.addComponent(UITransform);
    const canvasUi = canvas.node.getComponent(UITransform);
    const CW = canvasUi?.contentSize.width  ?? 750;
    const CH = canvasUi?.contentSize.height ?? 1334;
    dimUi.setContentSize(CW, CH);
    dimUi.setAnchorPoint(0.5, 0.5);
    const dimG = overlay.addComponent(Graphics);
    dimG.fillColor = C_BG_DIM;
    dimG.rect(-CW / 2, -CH / 2, CW, CH);
    dimG.fill();

    // ── Build section heights ───────────────────────────────────────────────
    const rooms        = result.rooms.filter(r => !r.empty);
    const emptyRooms   = result.rooms.filter(r => r.empty);
    const bonuses      = result.bonuses;
    const hasBonus     = bonuses.length > 0;
    const hasPenalty   = result.emptyRoomPenalty !== 0 || result.inaccessiblePenalty !== 0;

    const roomSectionH  = ROW_H * (result.rooms.length) + SEC_GAP;
    const bonusSectionH = hasBonus ? ROW_H * bonuses.length + SEC_GAP : 0;
    const penaltySectionH = hasPenalty ? ROW_H + SEC_GAP : 0;

    const cardH = TITLE_H + PAD
      + ROW_H            // "房间得分" header
      + roomSectionH
      + (hasBonus ? ROW_H + bonusSectionH : 0)
      + (hasPenalty ? ROW_H + penaltySectionH : 0)
      + TOTAL_H + PAD * 2;

    // ── Card background ────────────────────────────────────────────────────
    const card = new Node('card');
    overlay.addChild(card);
    card.setPosition(0, 0, 0);
    card.addComponent(UITransform).setContentSize(CARD_W, cardH);
    const cardG = card.addComponent(Graphics);
    cardG.fillColor   = C_CARD;
    cardG.strokeColor = C_BORDER;
    cardG.lineWidth   = 1.5;
    cardG.roundRect(-CARD_W / 2, -cardH / 2, CARD_W, cardH, 14);
    cardG.fill();
    cardG.stroke();

    // ── Content cursor (y from top of card, positive = down) ──────────────
    let cursor = cardH / 2;   // starts at top edge of card (y-up canvas)

    const addLabel = (
      text: string, fontSize: number, color: Color,
      xOffset = 0, bold = false, alignRight = false,
    ): void => {
      const n = new Node();
      card.addChild(n);
      n.setPosition(xOffset, cursor - ROW_H / 2, 0);
      const lbl = n.addComponent(Label);
      lbl.string            = text;
      lbl.fontSize          = fontSize;
      lbl.color             = color;
      lbl.isBold            = bold;
      lbl.enableWrapText    = false;
      lbl.overflow          = (Label as any).Overflow?.NONE ?? 0;
      if (alignRight) {
        n.getComponent(UITransform)?.setAnchorPoint(1, 0.5);
        n.setPosition(CARD_W / 2 - PAD, cursor - ROW_H / 2, 0);
      }
    };

    const addDivider = (): void => {
      const n = new Node('div');
      card.addChild(n);
      n.setPosition(0, cursor, 0);
      const g = n.addComponent(Graphics);
      g.strokeColor = C_DIVIDER;
      g.lineWidth   = 1;
      g.moveTo(-CARD_W / 2 + PAD, 0);
      g.lineTo( CARD_W / 2 - PAD, 0);
      g.stroke();
    };

    const advanceSec = (): void => { cursor -= SEC_GAP; };

    // ── Title ──────────────────────────────────────────────────────────────
    cursor -= TITLE_H / 2 + PAD / 2;
    addLabel('最终得分', 30, C_TITLE, 0, true);
    cursor -= TITLE_H / 2;
    addDivider();

    // ── Room scores ────────────────────────────────────────────────────────
    cursor -= SEC_GAP / 2;
    cursor -= ROW_H / 2;
    addLabel('房间得分', 20, C_SOFT, -CARD_W / 2 + PAD + 8, true);
    cursor -= ROW_H / 2;

    const maxCells = Math.max(...result.rooms.map(r => r.countedSquares), 1);

    for (const room of result.rooms) {
      const sq    = room.countedSquares;
      const empty = room.empty;
      const color = empty ? C_GREY : C_WHITE;

      // Room name
      addLabel(room.name_zh, 20, color, -CARD_W / 2 + PAD + 8);

      // Mini bar
      if (!empty && sq > 0) {
        const barMaxW = 160;
        const barW    = Math.max(4, Math.round((sq / maxCells) * barMaxW));
        const barH    = 10;
        const barX    = -CARD_W / 2 + PAD + 8 + 90;
        const barY    = cursor - ROW_H / 2;
        const barNode = new Node('bar');
        card.addChild(barNode);
        barNode.setPosition(barX + barW / 2, barY, 0);
        const bg = barNode.addComponent(Graphics);
        bg.fillColor = new Color(255, 255, 255, 25);
        bg.rect(-barMaxW / 2, -barH / 2, barMaxW, barH);
        bg.fill();
        bg.fillColor = empty ? C_GREY : C_GREEN;
        bg.rect(-barW / 2 - (barMaxW - barW) / 2, -barH / 2, barW, barH);
        bg.fill();
      }

      // Score
      const scoreText = empty ? '空房间' : `${sq} 格`;
      addLabel(scoreText, 20, empty ? C_GREY : C_GREEN, CARD_W / 2 - PAD - 60, false, true);

      cursor -= ROW_H;
    }

    advanceSec();

    // ── Bonuses ────────────────────────────────────────────────────────────
    if (hasBonus) {
      addDivider();
      cursor -= SEC_GAP / 2;
      cursor -= ROW_H / 2;
      addLabel('奖励目标', 20, C_SOFT, -CARD_W / 2 + PAD + 8, true);
      cursor -= ROW_H / 2;

      for (const b of bonuses) {
        const earned = b.earned;
        const icon   = earned ? '✓' : '✗';
        const color  = earned ? C_GREEN : C_GREY;
        addLabel(`${icon}  ${b.text_zh}`, 19, color, -CARD_W / 2 + PAD + 8);
        addLabel(earned ? `+${b.points}` : `+0`, 19, color, CARD_W / 2 - PAD - 60, false, true);
        cursor -= ROW_H;
      }
      advanceSec();
    }

    // ── Penalties ──────────────────────────────────────────────────────────
    if (hasPenalty) {
      addDivider();
      cursor -= SEC_GAP / 2 + ROW_H / 2;
      const pen = result.emptyRoomPenalty + result.inaccessiblePenalty;
      addLabel('空房间 / 无障碍扣分', 19, C_GREY, -CARD_W / 2 + PAD + 8);
      addLabel(`${pen}`, 19, new Color(255, 120, 120, 255), CARD_W / 2 - PAD - 60, false, true);
      cursor -= ROW_H / 2;
      advanceSec();
    }

    // ── Total ──────────────────────────────────────────────────────────────
    addDivider();
    cursor -= SEC_GAP / 2;

    // Highlight background for total row
    const totalBgNode = new Node('totalBg');
    card.addChild(totalBgNode);
    totalBgNode.setPosition(0, cursor - TOTAL_H / 2, 0);
    totalBgNode.addComponent(UITransform).setContentSize(CARD_W - PAD * 2, TOTAL_H - 4);
    const totalBg = totalBgNode.addComponent(Graphics);
    totalBg.fillColor   = C_TOTAL_BG;
    totalBg.strokeColor = C_TOTAL_BORDER;
    totalBg.lineWidth   = 1;
    totalBg.roundRect(-(CARD_W - PAD * 2) / 2, -(TOTAL_H - 4) / 2, CARD_W - PAD * 2, TOTAL_H - 4, 8);
    totalBg.fill();
    totalBg.stroke();

    cursor -= (TOTAL_H - ROW_H) / 2;
    addLabel('总分', 26, C_TITLE, -CARD_W / 2 + PAD + 8, true);
    addLabel(`${result.total}`, 30, C_TITLE, CARD_W / 2 - PAD - 60, true, true);
    cursor -= ROW_H;

    // ── Close button ────────────────────────────────────────────────────────
    cursor -= PAD + 8;
    const btnNode = new Node('restartBtn');
    overlay.addChild(btnNode);
    btnNode.setPosition(0, cursor - 28, 0);
    btnNode.addComponent(UITransform).setContentSize(200, 52);
    const btnG = btnNode.addComponent(Graphics);
    btnG.fillColor = new Color(70, 120, 200, 255);
    btnG.roundRect(-100, -26, 200, 52, 10);
    btnG.fill();
    const btnLbl = new Node('lbl');
    btnNode.addChild(btnLbl);
    const lbl = btnLbl.addComponent(Label);
    lbl.string   = '再来一局';
    lbl.fontSize = 22;
    lbl.color    = C_WHITE;
    btnNode.on(Node.EventType.TOUCH_END, () => gameStore.getState().unfinishGame());
  }
}
