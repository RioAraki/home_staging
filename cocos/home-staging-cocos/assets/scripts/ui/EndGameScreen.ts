import { _decorator, Component, Label, Button } from 'cc';
import { gameStore } from '../state/gameStore';
import { computeScore } from '../core/scoring';
import { styleButton } from './StyledButton';
const { ccclass, property } = _decorator;

@ccclass('EndGameScreen')
export class EndGameScreen extends Component {
  @property(Label)  detailLabel!: Label;
  @property(Button) closeBtn!: Button;

  private unsub?: () => void;

  start() {
    if (this.node) this.node.active = false;
    if (this.closeBtn) {
      this.closeBtn.node.on(Button.EventType.CLICK, () => {
        gameStore.getState().unfinishGame();
      });
      styleButton(this.closeBtn);
    }
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.gameFinished !== prev.gameFinished) {
        if (s.gameFinished) this.show();
        else if (this.node) this.node.active = false;
      }
    });
  }

  onDestroy() { this.unsub?.(); }

  private show() {
    if (!this.node || !this.detailLabel) return;
    const s = gameStore.getState();
    if (!s.scenario) return;
    try {
      const result = computeScore(
        s.scenario,
        s.placedPieces,
        s.walls,
        s.doors,
        s.frontDoorEdge,
        s.windows,
      );
      const lines: string[] = [`总分: ${result.total}`, ''];
      for (const b of result.bonuses) {
        const mark = b.earned ? '✓' : '✗';
        lines.push(`${mark} +${b.points}  ${b.text_zh}`);
      }
      if (result.emptyRoomPenalty !== 0) {
        lines.push('');
        lines.push(`空房间扣分: ${result.emptyRoomPenalty}`);
      }
      this.detailLabel.string = lines.join('\n');
    } catch (e) {
      this.detailLabel.string = `Score eval failed: ${e}`;
    }
    this.node.active = true;
  }
}
