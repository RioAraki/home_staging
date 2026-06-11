import { _decorator, Component, Label, Node, UITransform, Color, Widget } from 'cc';
import { gameStore } from '../state/gameStore';
import { computeScore } from '../core/scoring';
const { ccclass, property } = _decorator;

/**
 * Always-visible bonus tracker shown above the floor plan.
 * Updates in real-time as furniture is placed / walls drawn / doors added.
 * Each bonus item shows ✓ (earned) or ○ (not yet) with its point value.
 */
const TITLE_H     = 28;   // title strip height
const LINE_H      = 24;   // bonus line height (matches label lineHeight)
const PAD_V       = 8;    // top/bottom padding
const FONT_SIZE   = 18;

@ccclass('BonusPanel')
export class BonusPanel extends Component {
  @property(Label) summaryLabel!: Label;

  private unsub?: () => void;
  private titleNode: Node | null = null;
  private widget: Widget | null = null;

  start() {
    // Use Widget to sit in the top strip, between RoomProgressPanel (left)
    // and AudioControls (right) — both 170 px wide at their respective edges.
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setContentSize(400, 100);
    const widget = this.node.addComponent(Widget);
    this.widget = widget;
    widget.isAlignTop   = true;
    widget.isAlignLeft  = true;
    widget.isAlignRight = true;
    widget.top   = 8;
    widget.left  = 210;   // clear of RoomProgressPanel (190px wide + 20px gap)
    widget.right = 144;   // clear of "☰" + gear buttons (2×52px + margins)
    widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

    // Title label "奖励目标"
    const titleNode = new Node('BonusTitleLabel');
    this.node.addChild(titleNode);
    this.titleNode = titleNode;
    const titleLbl = titleNode.addComponent(Label);
    titleLbl.string   = '奖励目标';
    titleLbl.fontSize = 20;
    titleLbl.isBold   = true;
    titleLbl.color    = new Color(255, 225, 105, 255);

    if (this.summaryLabel) {
      this.summaryLabel.node.active = true;
      this.summaryLabel.fontSize        = FONT_SIZE;
      this.summaryLabel.lineHeight      = LINE_H;
      this.summaryLabel.enableWrapText  = false;
      this.summaryLabel.overflow        = (Label as any).Overflow?.SHRINK ?? 2;
    }

    this.refresh();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.scenario           !== prev.scenario           ||
          s.placedPieces       !== prev.placedPieces       ||
          s.walls              !== prev.walls               ||
          s.doors              !== prev.doors               ||
          s.frontDoorEdge      !== prev.frontDoorEdge      ||
          s.windows            !== prev.windows             ||
          s.completedRoomSlots !== prev.completedRoomSlots) {
        this.refresh();
      }
    });
  }

  onDestroy() { this.unsub?.(); }

  /** Size the panel to its content: title strip + one line per bonus.
   *  Fixed sizes overflowed on scenarios with 4–5 bonuses (SHRINK made the
   *  text tiny and it collided with the title). */
  private layout(lineCount: number) {
    const visible = lineCount > 0;
    if (this.titleNode) this.titleNode.active = visible;
    if (!visible) return;

    const lblH   = lineCount * LINE_H;
    const panelH = PAD_V + TITLE_H + lblH + PAD_V;
    const ui = this.node.getComponent(UITransform)!;
    ui.setContentSize(ui.contentSize.width, panelH);
    // Re-pin the top edge: the widget only re-aligns on window resize, so a
    // height change would otherwise drift the panel off its top anchor.
    this.widget?.updateAlignment();

    this.titleNode?.setPosition(0, panelH / 2 - PAD_V - TITLE_H / 2, 0);

    const lblUi = this.summaryLabel.node.getComponent(UITransform)
               ?? this.summaryLabel.node.addComponent(UITransform);
    lblUi.setContentSize(Math.max(ui.contentSize.width - 20, 200), lblH);
    this.summaryLabel.node.setPosition(0, panelH / 2 - PAD_V - TITLE_H - lblH / 2, 0);
  }

  private refresh() {
    if (!this.summaryLabel) return;
    const s = gameStore.getState();
    if (!s.scenario) { this.summaryLabel.string = ''; this.layout(0); return; }

    try {
      const result = computeScore(
        s.scenario,
        s.placedPieces,
        s.walls,
        s.doors,
        s.frontDoorEdge,
        s.windows,
      );

      const lines = result.bonuses.map((b) => {
        const mark = b.earned ? '✓' : '○';
        return `${mark} +${b.points}  ${b.text_zh}`;
      });

      if (result.bonuses.length === 0) {
        this.summaryLabel.string = '';
        this.layout(0);
        return;
      }

      this.summaryLabel.string = lines.join('\n');
      this.layout(lines.length);
      // Tint earned lines green, un-earned gray — use a single colour for
      // the whole label (most scenarios have 1–3 bonuses; mixed colours
      // require RichText which adds complexity).
      const allEarned = result.bonuses.every(b => b.earned);
      const noneEarned = result.bonuses.every(b => !b.earned);
      this.summaryLabel.color = allEarned
        ? new Color(100, 220, 130, 255)   // all done → green
        : noneEarned
          ? new Color(180, 180, 180, 255) // none done → gray
          : new Color(255, 210,  80, 255);// partial → yellow
    } catch {
      this.summaryLabel.string = '';
      this.layout(0);
    }
  }
}
