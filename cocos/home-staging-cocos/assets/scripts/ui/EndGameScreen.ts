import {
  _decorator, Component, Label, Button, Node, UITransform,
  Graphics, Color, Widget, director, Canvas,
} from 'cc';
import { gameStore } from '../state/gameStore';
import { computeScore } from '../core/scoring';
const { ccclass, property } = _decorator;

// ── Layout ────────────────────────────────────────────────────────────────────
const CARD_W   = 500;
const PAD      = 24;
const ROW_H    = 38;
const SEC_GAP  = 12;
const TITLE_H  = 54;
const TOTAL_H  = 52;
const BTN_H    = 52;
const INNER_W  = CARD_W - PAD * 2;   // usable width inside card
const SCORE_W  = 70;                  // right column width for scores
const BAR_W    = 140;                 // max bar width
const TEXT_W   = INNER_W - SCORE_W - BAR_W - 8;  // room-name column

// Colours
const C_DIM          = new Color(0,   0,   0,   200);
const C_CARD         = new Color(12,  28,  55,  252);
const C_BORDER       = new Color(255, 255, 255, 40);
const C_TITLE        = new Color(255, 225, 105, 255);
const C_WHITE        = new Color(255, 255, 255, 255);
const C_SOFT         = new Color(170, 175, 195, 255);
const C_GREEN        = new Color(90,  210, 120, 255);
const C_GREY         = new Color(120, 125, 140, 255);
const C_DIVIDER      = new Color(255, 255, 255, 28);
const C_TOTAL_FILL   = new Color(255, 225, 105, 22);
const C_TOTAL_BORDER = new Color(255, 225, 105, 70);
const C_BAR_BG       = new Color(255, 255, 255, 18);
const C_BAR_FG       = new Color(90,  210, 120, 255);
const C_BTN          = new Color(60,  110, 200, 255);
// ─────────────────────────────────────────────────────────────────────────────

@ccclass('EndGameScreen')
export class EndGameScreen extends Component {
  @property(Label)  detailLabel!: Label;
  @property(Button) closeBtn!: Button;

  private overlay: Node | null = null;
  private unsub?: () => void;

  start() {
    if (this.node) this.node.active = false;
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

  private hide() {
    this.overlay?.destroy();
    this.overlay = null;
    if (this.node) this.node.active = false;
  }

  private show() {
    this.hide();
    const s = gameStore.getState();
    if (!s.scenario) return;

    let result;
    try {
      result = computeScore(
        s.scenario, s.placedPieces, s.walls,
        s.doors, s.frontDoorEdge, s.windows,
      );
    } catch { return; }

    const canvas = director.getScene()?.getComponentInChildren(Canvas);
    if (!canvas) return;

    // ── Full-screen dim overlay ────────────────────────────────────────────
    const overlay = new Node('EndGameOverlay');
    canvas.node.addChild(overlay);
    this.overlay = overlay;

    const canvasUi = canvas.node.getComponent(UITransform);
    const CW = canvasUi?.contentSize.width  ?? 750;
    const CH = canvasUi?.contentSize.height ?? 1334;
    const dimUi = overlay.addComponent(UITransform);
    dimUi.setContentSize(CW, CH);
    const dimG = overlay.addComponent(Graphics);
    dimG.fillColor = C_DIM;
    dimG.rect(-CW / 2, -CH / 2, CW, CH);
    dimG.fill();

    // ── Compute content sections ───────────────────────────────────────────
    const rooms    = result.rooms;
    const bonuses  = result.bonuses;
    const hasBonus = bonuses.length > 0;
    const penalty  = result.emptyRoomPenalty + result.inaccessiblePenalty;

    // card height = sum of all sections + button
    const cardH =
      PAD +
      TITLE_H +
      SEC_GAP +
      ROW_H +                            // "房间得分" header
      rooms.length * ROW_H + SEC_GAP +
      (hasBonus
        ? ROW_H + bonuses.length * ROW_H + SEC_GAP
        : 0) +
      (penalty !== 0 ? ROW_H + SEC_GAP : 0) +
      TOTAL_H +
      SEC_GAP +
      BTN_H +
      PAD;

    // ── Card node (all content lives inside here) ──────────────────────────
    const card = new Node('card');
    overlay.addChild(card);
    card.setPosition(0, 0, 0);
    const cardUi = card.addComponent(UITransform);
    cardUi.setContentSize(CARD_W, cardH);
    cardUi.setAnchorPoint(0.5, 0.5);

    const cardG = card.addComponent(Graphics);
    cardG.fillColor   = C_CARD;
    cardG.strokeColor = C_BORDER;
    cardG.lineWidth   = 1.5;
    cardG.roundRect(-CARD_W / 2, -cardH / 2, CARD_W, cardH, 16);
    cardG.fill();
    cardG.stroke();

    // ── Cursor: starts at card top, moves downward ─────────────────────────
    // In card-local coords: top = +cardH/2, bottom = -cardH/2.
    let cur = cardH / 2 - PAD;

    // Helper: add one text row.
    // anchor (0, 0.5) = left-edge aligned; width caps the label so text never
    // overflows into the score column.
    const row = (
      text: string, fontSize: number, color: Color,
      maxW: number, xLeft: number, yCenter: number,
      bold = false,
    ) => {
      const n = new Node();
      card.addChild(n);
      const ui = n.addComponent(UITransform);
      ui.setContentSize(maxW, ROW_H);
      ui.setAnchorPoint(0, 0.5);
      n.setPosition(xLeft, yCenter, 0);
      const lbl = n.addComponent(Label);
      lbl.string         = text;
      lbl.fontSize       = fontSize;
      lbl.color          = color;
      lbl.isBold         = bold;
      lbl.enableWrapText = false;
      lbl.overflow       = (Label as any).Overflow?.SHRINK ?? 2;
      lbl.horizontalAlign = (Label as any).HorizontalAlign?.LEFT ?? 0;
    };

    // Helper: right-aligned score column
    const scoreCol = (
      text: string, fontSize: number, color: Color, yCenter: number, bold = false,
    ) => {
      const n = new Node();
      card.addChild(n);
      const ui = n.addComponent(UITransform);
      ui.setContentSize(SCORE_W, ROW_H);
      ui.setAnchorPoint(1, 0.5);
      n.setPosition(CARD_W / 2 - PAD, yCenter, 0);
      const lbl = n.addComponent(Label);
      lbl.string          = text;
      lbl.fontSize        = fontSize;
      lbl.color           = color;
      lbl.isBold          = bold;
      lbl.enableWrapText  = false;
      lbl.horizontalAlign = (Label as any).HorizontalAlign?.RIGHT ?? 2;
    };

    const divider = (y: number) => {
      const n = new Node();
      card.addChild(n);
      const g = n.addComponent(Graphics);
      g.strokeColor = C_DIVIDER;
      g.lineWidth   = 1;
      g.moveTo(-CARD_W / 2 + PAD, y);
      g.lineTo( CARD_W / 2 - PAD, y);
      g.stroke();
    };

    const sectionHeader = (text: string, y: number) => {
      row(text, 18, C_SOFT, INNER_W, -CARD_W / 2 + PAD, y, true);
    };

    // ── Title ──────────────────────────────────────────────────────────────
    const titleY = cur - TITLE_H / 2;
    row('最终得分', 28, C_TITLE, INNER_W, -CARD_W / 2 + PAD, titleY, true);
    // Center the title
    {
      const n = card.children[card.children.length - 1];
      const ui = n.getComponent(UITransform)!;
      ui.setAnchorPoint(0.5, 0.5);
      n.setPosition(0, titleY, 0);
      const lbl = n.getComponent(Label)!;
      lbl.horizontalAlign = (Label as any).HorizontalAlign?.CENTER ?? 1;
    }
    cur -= TITLE_H;
    divider(cur);
    cur -= SEC_GAP;

    // ── Room scores ────────────────────────────────────────────────────────
    sectionHeader('房间得分', cur - ROW_H / 2);
    cur -= ROW_H;

    const maxCells = Math.max(...rooms.map(r => r.countedSquares), 1);
    const LEFT_X   = -CARD_W / 2 + PAD;
    const NAME_W   = 90;
    const BAR_X    = LEFT_X + NAME_W + 8;

    for (const room of rooms) {
      const sq    = room.countedSquares;
      const yC    = cur - ROW_H / 2;
      const color = room.empty ? C_GREY : C_WHITE;

      row(room.name_zh, 20, color, NAME_W, LEFT_X, yC);
      scoreCol(room.empty ? '空' : `${sq} 格`, 20, room.empty ? C_GREY : C_GREEN, yC);

      // Progress bar (only if not empty)
      if (!room.empty) {
        const filled = Math.max(2, Math.round((sq / maxCells) * BAR_W));
        const barNode = new Node('bar');
        card.addChild(barNode);
        const bg = barNode.addComponent(Graphics);
        // bg track
        bg.fillColor = C_BAR_BG;
        bg.roundRect(BAR_X, yC - 5, BAR_W, 10, 3);
        bg.fill();
        // filled portion
        bg.fillColor = C_BAR_FG;
        bg.roundRect(BAR_X, yC - 5, filled, 10, 3);
        bg.fill();
      }

      cur -= ROW_H;
    }
    cur -= SEC_GAP;

    // ── Bonuses ────────────────────────────────────────────────────────────
    if (hasBonus) {
      divider(cur);
      cur -= SEC_GAP;
      sectionHeader('奖励目标', cur - ROW_H / 2);
      cur -= ROW_H;

      for (const b of bonuses) {
        const yC    = cur - ROW_H / 2;
        const mark  = b.earned ? '✓' : '✗';
        const color = b.earned ? C_GREEN : C_GREY;
        // leave room for score on right: TEXT_W = INNER_W - SCORE_W - 4
        const bTextW = INNER_W - SCORE_W - 4;
        row(`${mark}  ${b.text_zh}`, 18, color, bTextW, LEFT_X, yC);
        scoreCol(b.earned ? `+${b.points}` : '+0', 18, color, yC);
        cur -= ROW_H;
      }
      cur -= SEC_GAP;
    }

    // ── Penalty ────────────────────────────────────────────────────────────
    if (penalty !== 0) {
      divider(cur);
      cur -= SEC_GAP;
      const yC = cur - ROW_H / 2;
      row('空房间 / 无障碍扣分', 18, C_GREY, INNER_W - SCORE_W - 4, LEFT_X, yC);
      scoreCol(`${penalty}`, 18, new Color(240, 100, 100, 255), yC);
      cur -= ROW_H + SEC_GAP;
    }

    // ── Total ──────────────────────────────────────────────────────────────
    divider(cur);
    cur -= SEC_GAP;

    const totalY   = cur - TOTAL_H / 2;
    const totalBg  = new Node('totalBg');
    card.addChild(totalBg);
    totalBg.setPosition(0, totalY, 0);
    totalBg.addComponent(UITransform).setContentSize(CARD_W - PAD * 2, TOTAL_H - 6);
    const tbg = totalBg.addComponent(Graphics);
    tbg.fillColor   = C_TOTAL_FILL;
    tbg.strokeColor = C_TOTAL_BORDER;
    tbg.lineWidth   = 1.2;
    tbg.roundRect(-(CARD_W - PAD * 2) / 2, -(TOTAL_H - 6) / 2, CARD_W - PAD * 2, TOTAL_H - 6, 8);
    tbg.fill();
    tbg.stroke();

    row('总分', 24, C_TITLE, INNER_W / 2, LEFT_X, totalY, true);
    scoreCol(`${result.total}`, 26, C_TITLE, totalY, true);
    cur -= TOTAL_H + SEC_GAP;

    // ── Button (child of card) ─────────────────────────────────────────────
    const btnY = cur - BTN_H / 2;
    const btn  = new Node('btn');
    card.addChild(btn);
    btn.setPosition(0, btnY, 0);
    btn.addComponent(UITransform).setContentSize(200, BTN_H);

    const btnG = btn.addComponent(Graphics);
    btnG.fillColor = C_BTN;
    btnG.roundRect(-100, -BTN_H / 2, 200, BTN_H, 10);
    btnG.fill();

    const btnLblNode = new Node();
    btn.addChild(btnLblNode);
    const btnLbl = btnLblNode.addComponent(Label);
    btnLbl.string   = '再来一局';
    btnLbl.fontSize = 22;
    btnLbl.color    = C_WHITE;

    btn.on(Node.EventType.TOUCH_END, () => gameStore.getState().unfinishGame());
  }
}
