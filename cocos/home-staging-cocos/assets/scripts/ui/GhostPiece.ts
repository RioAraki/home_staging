import { _decorator, Component, Node, Sprite, SpriteFrame, resources, UIOpacity, UITransform, Color } from 'cc';
import { gameStore } from '../state/gameStore';
import { cardByNumberVariant } from '../core/dataLoader';
import { transformOption } from '../core/geometry';
import { CELL_SIZE, GRID_ROWS, GRID_COLS } from './LayerRenderer';
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
      Math.max(0, Math.min(GRID_ROWS - 1, r)),
      Math.max(0, Math.min(GRID_COLS - 1, c)),
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
    const t = transformOption(opt, sel.rotation, sel.mirrored);
    const ui = this.sprite.getComponent(UITransform) ?? this.sprite.addComponent(UITransform);
    ui.setContentSize(t.bbox[1] * CELL_SIZE, t.bbox[0] * CELL_SIZE);
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
    const t = transformOption(opt, sel.rotation, sel.mirrored);
    const W = GRID_COLS * CELL_SIZE;
    const H = GRID_ROWS * CELL_SIZE;
    const x = this.origin[1] * CELL_SIZE - W / 2 + (t.bbox[1] * CELL_SIZE) / 2;
    const y = -this.origin[0] * CELL_SIZE + H / 2 - (t.bbox[0] * CELL_SIZE) / 2;
    this.sprite.setPosition(x, y, 0);
  }
}
