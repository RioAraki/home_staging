import { _decorator, Component, Label, Node, UITransform, Color } from 'cc';
import { gameStore } from '../state/gameStore';
import { computeScore } from '../core/scoring';
const { ccclass, property } = _decorator;

/**
 * Always-visible bonus tracker shown above the floor plan.
 * Updates in real-time as furniture is placed / walls drawn / doors added.
 * Each bonus item shows ✓ (earned) or ○ (not yet) with its point value.
 */
@ccclass('BonusPanel')
export class BonusPanel extends Component {
  @property(Label) summaryLabel!: Label;

  private unsub?: () => void;

  start() {
    // Reposition to top of canvas so it floats above the floor plan.
    this.node.setPosition(0, 590, 0);
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setContentSize(700, 120);

    // Title label "奖励目标" above the bonus list.
    const titleNode = new Node('BonusTitleLabel');
    this.node.addChild(titleNode);
    titleNode.setPosition(0, 48, 0);
    const titleLbl = titleNode.addComponent(Label);
    titleLbl.string    = '奖励目标';
    titleLbl.fontSize  = 22;
    titleLbl.isBold    = true;
    titleLbl.color     = new Color(255, 225, 105, 255);

    if (this.summaryLabel) {
      this.summaryLabel.node.active = true;
      this.summaryLabel.node.setPosition(0, -10, 0);
      this.summaryLabel.fontSize        = 20;
      this.summaryLabel.lineHeight      = 28;
      // Disable soft-wrap so each bonus stays on one line; use SHRINK so
      // long text scales down rather than spilling past the container.
      this.summaryLabel.enableWrapText  = false;
      this.summaryLabel.overflow        = (Label as any).Overflow?.SHRINK ?? 2;
      // Give the label enough horizontal room for the longest bonus line.
      const lblUi = this.summaryLabel.node.getComponent(UITransform)
                 ?? this.summaryLabel.node.addComponent(UITransform);
      lblUi.setContentSize(680, 100);
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

  private refresh() {
    if (!this.summaryLabel) return;
    const s = gameStore.getState();
    if (!s.scenario) { this.summaryLabel.string = ''; return; }

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
        const pts  = b.earned ? `+${b.points}` : `+${b.points}`;
        return `${mark} ${pts}  ${b.text_zh}`;
      });

      if (result.bonuses.length === 0) {
        this.summaryLabel.string = '';
        return;
      }

      this.summaryLabel.string = lines.join('\n');
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
    }
  }
}
