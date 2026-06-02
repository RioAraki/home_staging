import { _decorator, Component, Label, Button } from 'cc';
import { InputHandler } from './InputHandler';
const { ccclass, property } = _decorator;

/**
 * Simplified for now: the bottom action buttons (mirror / skip / confirm) and
 * the instructional status text are hidden to keep the screen clean. Placement
 * is committed by lifting the finger after dragging the ghost on the plan
 * (see InputHandler). Rotation is a horizontal swipe in the chooser.
 *
 * The component and its @property bindings are kept so the scene wiring stays
 * valid; we just hide everything it used to drive.
 */
@ccclass('SelectionStatus')
export class SelectionStatus extends Component {
  @property(Label) statusLabel!: Label;
  @property(Button) rotateBtn!: Button;
  @property(Button) mirrorBtn!: Button;
  @property(Button) cancelBtn!: Button;
  @property(Button) placeBtn!: Button;
  @property(InputHandler) inputHandler!: InputHandler;

  start() {
    for (const b of [this.rotateBtn, this.mirrorBtn, this.cancelBtn, this.placeBtn]) {
      if (b) b.node.active = false;
    }
    if (this.statusLabel) this.statusLabel.string = '';
  }
}
