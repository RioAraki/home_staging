import { _decorator, Component, Label } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Live in-game score is hidden by request (keeps the play screen clean). The
 * final score is shown by EndGameScreen. The @property binding is kept so the
 * scene wiring stays valid; we just hide the label.
 */
@ccclass('BonusPanel')
export class BonusPanel extends Component {
  @property(Label) summaryLabel!: Label;

  start() {
    if (this.summaryLabel) this.summaryLabel.node.active = false;
  }
}
