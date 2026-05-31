import { _decorator, Component, Node, Sprite, SpriteFrame, resources, UITransform } from 'cc';
import type { PlacedPiece as PlacedPieceData } from '../state/gameStore';
import { cardByNumberVariant } from '../core/dataLoader';
import { transformOption } from '../core/geometry';
import { CELL_SIZE, GRID_ROWS, GRID_COLS } from './LayerRenderer';
const { ccclass } = _decorator;

@ccclass('PlacedPiece')
export class PlacedPiece extends Component {
  init(p: PlacedPieceData) {
    const card = cardByNumberVariant(p.number, p.variant);
    const opt = card?.options.find(o => o.option_index === p.optionIndex);
    if (!opt) return;
    const t = transformOption(opt, p.rotation, p.mirrored);

    const sprite = this.getComponent(Sprite) ?? this.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    const url = `cards/options/${String(p.number).padStart(2, '0')}_${p.variant}_opt${p.optionIndex}/spriteFrame`;
    resources.load(url, SpriteFrame, (err, sf) => {
      if (!err && sf) sprite.spriteFrame = sf;
    });

    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setContentSize(t.bbox[1] * CELL_SIZE, t.bbox[0] * CELL_SIZE);

    const W = GRID_COLS * CELL_SIZE;
    const H = GRID_ROWS * CELL_SIZE;
    const x = p.origin[1] * CELL_SIZE - W / 2 + (t.bbox[1] * CELL_SIZE) / 2;
    const y = -p.origin[0] * CELL_SIZE + H / 2 - (t.bbox[0] * CELL_SIZE) / 2;
    this.node.setPosition(x, y, 0);
  }
}
