import { _decorator, Component, Node, Sprite, SpriteFrame, resources, UIOpacity, UITransform, Color } from 'cc';
import { gameStore } from '../state/gameStore';
import { cardByNumberVariant } from '../core/dataLoader';
import { transformOption } from '../core/geometry';
import { layout, edgeX, edgeY, FULL_GRID_ROWS, FULL_GRID_COLS } from './viewport';
const { ccclass, property } = _decorator;

@ccclass('GhostPiece')
export class GhostPiece extends Component {
  @property(Node) sprite!: Node;

  private unsub?: () => void;
  /** Origin in grid coords [row, col] of the top-left of the bbox. */
  private origin: [number, number] = [8, 8];

  start() {
    this.refresh();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.selectedOption !== prev.selectedOption) this.refresh();
      if (s.lastError !== prev.lastError && s.lastError) this.flashRed();
    });
  }

  onDestroy() { this.unsub?.(); }

  setOrigin(r: number, c: number) {
    this.origin = [
      Math.max(0, Math.min(FULL_GRID_ROWS - 1, r)),
      Math.max(0, Math.min(FULL_GRID_COLS - 1, c)),
    ];
    this.updatePosition();
  }

  getOrigin(): [number, number] { return this.origin; }

  private flashRed() {
    const sp = this.sprite?.getComponent(Sprite);
    if (!sp) return;
    const orig = sp.color.clone();
    sp.color = new Color(255, 100, 100, 255);
    this.scheduleOnce(() => { sp.color = orig; }, 0.2);
  }

  private refresh() {
    const s = gameStore.getState();
    const sel = s.selectedOption;
    if (!sel || !this.sprite) { if (this.node) this.node.active = false; return; }
    this.node.active = true;

    const sf = this.sprite.getComponent(Sprite) ?? this.sprite.addComponent(Sprite);
    sf.sizeMode = Sprite.SizeMode.CUSTOM;
    const url = `cards/options/${String(sel.number).padStart(2, '0')}_${sel.variant}_opt${sel.optionIndex}/spriteFrame`;
    resources.load(url, SpriteFrame, (err, frame) => { if (!err) sf.spriteFrame = frame; });

    const card = cardByNumberVariant(sel.number, sel.variant);
    const opt = card?.options.find(o => o.option_index === sel.optionIndex);
    if (!opt) return;
    const cell = layout().cell;
    const ui = this.sprite.getComponent(UITransform) ?? this.sprite.addComponent(UITransform);
    // Size to the UN-rotated footprint and rotate the node itself, so the
    // artwork visibly turns (rather than being squashed into a new bbox).
    ui.setContentSize(opt.bbox[1] * cell, opt.bbox[0] * cell);
    this.sprite.angle = -90 * sel.rotation;
    this.sprite.setScale(sel.mirrored ? -1 : 1, 1, 1);
    this.updatePosition();

    const op = this.sprite.getComponent(UIOpacity) ?? this.sprite.addComponent(UIOpacity);
    op.opacity = 150;
  }

  private updatePosition() {
    const s = gameStore.getState();
    const sel = s.selectedOption;
    if (!sel) return;
    const card = cardByNumberVariant(sel.number, sel.variant);
    const opt = card?.options.find(o => o.option_index === sel.optionIndex);
    if (!opt) return;
    // Footprint centre uses the ROTATED bbox; the node is sized to the
    // un-rotated bbox and spun, so its centre coincides with the footprint.
    const t = transformOption(opt, sel.rotation, sel.mirrored);
    const cell = layout().cell;
    const x = edgeX(this.origin[1]) + (t.bbox[1] * cell) / 2;
    const y = edgeY(this.origin[0]) - (t.bbox[0] * cell) / 2;
    this.sprite.setPosition(x, y, 0);
  }
}
