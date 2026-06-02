import {
  _decorator, Component, Node, UITransform, Sprite, SpriteFrame, resources,
  Graphics, Color, Label, LabelOutline, EventTouch, director,
} from 'cc';
import { gameStore, currentCard } from '../state/gameStore';
import { cardByNumberVariant } from '../core/dataLoader';
import { InputHandler } from './InputHandler';
const { ccclass, property } = _decorator;

const PX_PER_CELL = 52;       // shared cells→px scale so footprints are comparable
const SLOT_W = 240;           // fixed hit/layout slot per option
const SLOT_H = 240;
const FRAME_PAD = 8;
const MAX_FOOTPRINT_CELLS = 4;  // tallest furniture bbox dimension in the data
// Single shared title line for ALL options — sits above the tallest piece so
// every name aligns horizontally regardless of its image size.
const TITLE_Y = (MAX_FOOTPRINT_CELLS * PX_PER_CELL) / 2 + 18;
const OPT1_X = -250;
const OPT2_X = 35;
const CONFIRM_X = 300;

/**
 * Bottom chooser: the active room's current card shown as its two options,
 * sized to their real grid footprint (a 1x1 piece is 1/9 the area of 3x3),
 * each labelled with its name. Tap an option to select; horizontal-swipe the
 * selected option to rotate 90°. A 确定 button to the right commits placement
 * (placement happens ONLY via this button, never by dragging on the plan).
 */
@ccclass('RoomPanel')
export class RoomPanel extends Component {
  @property(Node) listContent!: Node;

  private unsub?: () => void;
  private input: InputHandler | null = null;

  start() {
    const c = this.listContent;
    if (c) {
      // The scene wraps this in a ScrollView+Mask (old horizontal list). The
      // new chooser is fixed, so disable scrolling and centre the content.
      const parent = c.parent;
      const sv = parent?.getComponent('cc.ScrollView' as any) as any;
      if (sv) sv.enabled = false;
      // No scrolling and no clipping for two fixed options — disable the Mask
      // so enlarged pieces aren't cut off by the old list viewport.
      const mask = parent?.getComponent('cc.Mask' as any) as any;
      if (mask) mask.enabled = false;
      const ui = c.getComponent(UITransform) ?? c.addComponent(UITransform);
      const pui = parent?.getComponent(UITransform);
      if (pui) ui.setContentSize(pui.contentSize.width, pui.contentSize.height);
      ui.setAnchorPoint(0.5, 0.5);
      c.setPosition(0, 0, 0);
    }
    this.input = director.getScene()?.getComponentInChildren(InputHandler) ?? null;

    this.rebuild();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.scenario        !== prev.scenario        ||
          s.activeRoomSlot  !== prev.activeRoomSlot  ||
          s.placedCardKeys  !== prev.placedCardKeys  ||
          s.skippedCardKeys !== prev.skippedCardKeys ||
          s.selectedOption  !== prev.selectedOption) {
        this.rebuild();
      }
    });
  }

  onDestroy() { this.unsub?.(); }

  private rebuild() {
    const c = this.listContent;
    if (!c) return;
    c.removeAllChildren();

    const s = gameStore.getState();
    const card = currentCard(s);
    if (!card) {
      this.showHint(s.activeRoomSlot ? '家具摆完，去造墙 / 门' : '请选择一个房间');
      return;
    }

    const variant = s.chosenVariants[card.number] ?? 'A';
    const data = cardByNumberVariant(card.number, variant);
    if (!data) return;

    const sel = s.selectedOption;
    for (const opt of data.options) {
      const isSel = !!sel && sel.slot === card.slot && sel.slotIdx === card.slotIdx &&
                    sel.optionIndex === opt.option_index;
      const x = opt.option_index === 1 ? OPT1_X : OPT2_X;
      this.makeOption(
        card.slot, card.slotIdx, card.number, variant, opt.option_index,
        opt.bbox, opt.name_zh, x, isSel,
        isSel && sel ? sel.rotation : 0, isSel && sel ? sel.mirrored : false,
      );
    }
    // Skip / Rotate / Place stacked (top→bottom) to the right of the options.
    this.makeButton(CONFIRM_X, 88, '跳过', new Color(150, 140, 120, 255), true,
      () => gameStore.getState().skipCard(card.slot, card.slotIdx));
    this.makeButton(CONFIRM_X, 0, '旋转', new Color(70, 120, 200, 255), !!sel,
      () => gameStore.getState().rotateSelection(1));
    this.makeButton(CONFIRM_X, -88, '放置', new Color(80, 160, 90, 255), !!sel,
      () => this.input?.tryPlaceAtGhost());
  }

  private makeOption(
    slot: any, slotIdx: number, number: number, variant: 'A' | 'B', optionIndex: number,
    bbox: [number, number], name: string, x: number, selected: boolean,
    rotation: number, mirrored: boolean,
  ) {
    const node = new Node(`opt${optionIndex}`);
    this.listContent.addChild(node);
    node.setPosition(x, 0, 0);
    node.addComponent(UITransform).setContentSize(SLOT_W, SLOT_H);  // fixed hit area

    // Touch-down picks this option up; drag it onto the floor plan (the ghost
    // follows the finger). Rotation is via the 旋转 button. The ghost stays
    // hidden until the finger reaches the plan, so a tap no longer auto-hovers.
    node.on(Node.EventType.TOUCH_START, () => {
      gameStore.getState().selectOption({ slot, slotIdx, optionIndex });
    });
    node.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
      this.input?.dragGhost(e);
    });

    // Frame (drawn to the real footprint once we know the cell size).
    const frame = new Node('frame');
    node.addChild(frame);
    frame.addComponent(UITransform);
    const fg = frame.addComponent(Graphics);

    // Footprint box from the bbox at the shared scale — this is what makes a
    // 1x1 piece render 1/9 the area of a 3x3 piece.
    const boxW = bbox[1] * PX_PER_CELL;
    const boxH = bbox[0] * PX_PER_CELL;

    const imgNode = new Node('img');
    node.addChild(imgNode);
    const imgUi = imgNode.addComponent(UITransform);
    imgNode.angle = -90 * rotation;
    imgNode.setScale(mirrored ? -1 : 1, 1, 1);
    const sprite = imgNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;

    // Name as a title on one shared line for every option (added last → above
    // the image), dark outline for contrast.
    const nameNode = new Node('name');
    node.addChild(nameNode);
    nameNode.setPosition(0, TITLE_Y, 0);
    const nameLabel = nameNode.addComponent(Label);
    nameLabel.string = name;
    nameLabel.fontSize = 22;
    nameLabel.color = selected ? new Color(255, 240, 200, 255) : new Color(255, 255, 255, 255);
    const outline = nameNode.addComponent(LabelOutline);
    outline.color = new Color(0, 0, 0, 230);
    outline.width = 2;

    const url = `cards/vector/${String(number).padStart(2, '0')}_${variant}_opt${optionIndex}/spriteFrame`;
    resources.load(url, SpriteFrame, (err, sf) => {
      if (err || !sf) return;
      sprite.spriteFrame = sf;
      // Fit the native image INSIDE the footprint box, preserving its aspect
      // ratio (no distortion). Size is governed by the footprint → comparable.
      const orig = (sf as any).originalSize;
      const nw = orig ? orig.width : sf.rect.width;
      const nh = orig ? orig.height : sf.rect.height;
      const k = Math.min(boxW / nw, boxH / nh);
      const w = Math.max(1, Math.round(nw * k));
      const h = Math.max(1, Math.round(nh * k));
      imgUi.setContentSize(w, h);
      const fw = w + FRAME_PAD * 2, fh = h + FRAME_PAD * 2;
      fg.clear();
      // Dark navy fill so the white line-art reads; lighter stroke when selected.
      fg.fillColor = new Color(16, 42, 71, 255);
      fg.strokeColor = selected ? new Color(255, 225, 105, 255) : new Color(120, 150, 185, 255);
      fg.lineWidth = selected ? 4 : 2;
      fg.rect(-fw / 2, -fh / 2, fw, fh);
      fg.fill();
      fg.stroke();
    });
  }

  private makeButton(
    x: number, y: number, label: string, fill: Color, enabled: boolean, onTap: () => void,
  ) {
    const node = new Node(label);
    this.listContent.addChild(node);
    node.setPosition(x, y, 0);
    node.addComponent(UITransform).setContentSize(110, 64);

    const g = node.addComponent(Graphics);
    g.fillColor = enabled ? fill : new Color(170, 170, 170, 255);
    g.roundRect(-55, -32, 110, 64, 10);
    g.fill();

    const lblNode = new Node('label');
    node.addChild(lblNode);
    const lbl = lblNode.addComponent(Label);
    lbl.string = label;
    lbl.fontSize = 26;
    lbl.color = new Color(255, 255, 255, 255);

    node.on(Node.EventType.TOUCH_END, () => { if (enabled) onTap(); });
  }

  private showHint(text: string) {
    const node = new Node('hint');
    this.listContent.addChild(node);
    const hint = node.addComponent(Label);
    hint.string = text;
    hint.fontSize = 22;
    hint.color = new Color(90, 80, 60, 255);
  }
}
