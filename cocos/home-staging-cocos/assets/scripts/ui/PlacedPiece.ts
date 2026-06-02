import { _decorator, Component, Node, Sprite, SpriteFrame, resources, UITransform } from 'cc';
import type { PlacedPiece as PlacedPieceData } from '../state/gameStore';
import { cardByNumberVariant } from '../core/dataLoader';
import { transformOption } from '../core/geometry';
import { layout, edgeX, edgeY } from './viewport';
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

    const cell = layout().cell;
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    // Size to the un-rotated footprint and rotate/mirror the node, so the
    // artwork visibly turns. Centre uses the rotated bbox.
    ui.setContentSize(opt.bbox[1] * cell, opt.bbox[0] * cell);
    this.node.angle = -90 * p.rotation;
    this.node.setScale(p.mirrored ? -1 : 1, 1, 1);

    const x = edgeX(p.origin[1]) + (t.bbox[1] * cell) / 2;
    const y = edgeY(p.origin[0]) - (t.bbox[0] * cell) / 2;
    this.node.setPosition(x, y, 0);
  }
}
