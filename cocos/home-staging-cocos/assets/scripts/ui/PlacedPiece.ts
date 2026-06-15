import { _decorator, Component, Node, Sprite, SpriteFrame, resources, UITransform, Graphics, Color } from 'cc';
import type { PlacedPiece as PlacedPieceData } from '../state/gameStore';
import { resolveOption } from '../core/pieces';
import { furnitureByName } from '../core/dataLoader';
import { transformOption } from '../core/geometry';
import { layout, edgeX, edgeY } from './viewport';
const { ccclass } = _decorator;

@ccclass('PlacedPiece')
export class PlacedPiece extends Component {
  init(p: PlacedPieceData) {
    const opt = resolveOption(p);
    if (!opt) return;
    const t = transformOption(opt, p.rotation, p.mirrored);
    const cell = layout().cell;

    // The piece node stays at the FloorPlan origin, un-rotated, so its Graphics
    // and child positions are in plain FloorPlan coords.
    this.node.setPosition(0, 0, 0);
    this.node.angle = 0;
    this.node.setScale(1, 1, 1);

    const g = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
    g.clear();
    const [or, oc] = p.origin;

    const entry = p.source === 'custom' && p.name ? furnitureByName(p.name) : undefined;
    const tiles = entry?.tiles ?? [];
    if (p.source === 'custom' && tiles.length) {
      // Composite the assembler tile sprites (resources/tiles/<name>.png).
      // A container sized to the UN-rotated bbox carries the piece's rotation/
      // mirror (same approach as the vector sprite); each tile carries its own
      // intrinsic rotation/mirror within its cell.
      const cont = new Node('tiles');
      this.node.addChild(cont);
      cont.addComponent(UITransform).setContentSize(opt.bbox[1] * cell, opt.bbox[0] * cell);
      cont.angle = -90 * p.rotation;
      cont.setScale(p.mirrored ? -1 : 1, 1, 1);
      cont.setPosition(
        edgeX(p.origin[1]) + (t.bbox[1] * cell) / 2,
        edgeY(p.origin[0]) - (t.bbox[0] * cell) / 2,
        0,
      );
      const bw = opt.bbox[1] * cell, bh = opt.bbox[0] * cell;
      for (const tile of tiles) {
        const tn = new Node('t');
        cont.addChild(tn);
        tn.addComponent(UITransform).setContentSize(cell, cell);
        tn.setPosition(tile.col * cell + cell / 2 - bw / 2, bh / 2 - (tile.row * cell + cell / 2), 0);
        tn.angle = -(tile.rotation ?? 0);              // assembler stores degrees CW
        tn.setScale(tile.mirror ? -1 : 1, 1, 1);
        const sp = tn.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load(`tiles/${tile.tile}/spriteFrame`, SpriteFrame, (err, sf) => {
          if (!err && sf && tn.isValid) sp.spriteFrame = sf;
        });
      }
    } else if (p.source === 'custom') {
      // Fallback (no tile data): white-stroked footprint cells.
      g.lineWidth = 2;
      for (const [r, c] of t.shape) {
        const x = edgeX(oc + c), y = edgeY(or + r) - cell;
        g.fillColor = new Color(255, 255, 255, 40);
        g.rect(x, y, cell, cell);
        g.fill();
        g.strokeColor = new Color(255, 255, 255, 210);
        g.rect(x, y, cell, cell);
        g.stroke();
      }
    } else {
      // 'img' child: the rotated/mirrored white line-art sprite (cards/vector).
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
    }

    // Open-space dots (all pieces): a small white dot at each absolute open cell.
    g.fillColor = new Color(255, 255, 255, 120);
    const radius = Math.max(2, cell * 0.08);
    for (const [r, c] of t.open_spaces) {
      const ox = edgeX(oc + c) + cell / 2;
      const oy = edgeY(or + r) - cell / 2;
      g.circle(ox, oy, radius);
      g.fill();
    }
  }
}
