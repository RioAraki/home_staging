import { _decorator, Component, Node, Sprite, SpriteFrame, resources, UITransform, Graphics, Color } from 'cc';
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
    const cell = layout().cell;

    // The piece node stays at the FloorPlan origin, un-rotated, so its Graphics
    // and child positions are in plain FloorPlan coords.
    this.node.setPosition(0, 0, 0);
    this.node.angle = 0;
    this.node.setScale(1, 1, 1);

    // 'img' child: the rotated/mirrored white line-art sprite.
    const imgNode = new Node('img');
    this.node.addChild(imgNode);
    const ui = imgNode.getComponent(UITransform) ?? imgNode.addComponent(UITransform);
    // Size to the UN-rotated footprint; rotate/mirror the child node itself.
    ui.setContentSize(opt.bbox[1] * cell, opt.bbox[0] * cell);
    imgNode.angle = -90 * p.rotation;
    imgNode.setScale(p.mirrored ? -1 : 1, 1, 1);
    // Centre uses the ROTATED bbox (the visible footprint).
    const cx = edgeX(p.origin[1]) + (t.bbox[1] * cell) / 2;
    const cy = edgeY(p.origin[0]) - (t.bbox[0] * cell) / 2;
    imgNode.setPosition(cx, cy, 0);

    const sprite = imgNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    const url = `cards/vector/${String(p.number).padStart(2, '0')}_${p.variant}_opt${p.optionIndex}/spriteFrame`;
    resources.load(url, SpriteFrame, (err, sf) => {
      // The placed layer is rebuilt on every placement change — the load may
      // resolve after this node was destroyed.
      if (!err && sf && imgNode.isValid) sprite.spriteFrame = sf;
    });

    // Graphics on the piece node (un-rotated): a small white dot at each
    // absolute open-space cell centre.
    const g = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
    g.clear();
    g.fillColor = new Color(255, 255, 255, 120);
    const radius = Math.max(2, cell * 0.08);
    const [or, oc] = p.origin;
    for (const [r, c] of t.open_spaces) {
      const ox = edgeX(oc + c) + cell / 2;
      const oy = edgeY(or + r) - cell / 2;
      g.circle(ox, oy, radius);
      g.fill();
    }
  }
}
