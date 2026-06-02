import {
  _decorator, Component, Node, UITransform, Sprite, SpriteFrame, resources,
  Graphics, Color, Label, EventTouch, Vec3,
} from 'cc';
import { gameStore, currentCard } from '../state/gameStore';
import { cardByNumberVariant } from '../core/dataLoader';
const { ccclass, property } = _decorator;

const OPT_MAX = 150;         // longest edge of an option image (px); aspect kept
const FRAME_PAD = 10;        // highlight frame padding around the image
const SWIPE_THRESHOLD = 30;  // px of horizontal drag that counts as a rotate

/**
 * Bottom "two-choice" chooser. Shows ONLY the active room's current card and
 * its two options side by side; tap one to select, horizontal-swipe to rotate
 * the selected piece 90°. When the room enters the construction phase
 * (all furniture placed/skipped) it shows a hint instead.
 *
 * Kept under @ccclass('RoomPanel') so the existing scene node binding survives.
 */
@ccclass('RoomPanel')
export class RoomPanel extends Component {
  @property(Node) listContent!: Node;

  private unsub?: () => void;
  private touchStartX = 0;
  private hint!: Label;

  start() {
    const c = this.listContent;
    if (c) {
      // The scene wraps this content node in a ScrollView+Mask (it used to be a
      // horizontal scrolling card list). The new chooser is two fixed options,
      // so disable scrolling and center the content inside the masked viewport
      // — otherwise the left option falls outside the mask and gets clipped.
      const parent = c.parent;
      const sv = parent?.getComponent('cc.ScrollView' as any) as any;
      if (sv) sv.enabled = false;
      const ui = c.getComponent(UITransform) ?? c.addComponent(UITransform);
      const pui = parent?.getComponent(UITransform);
      if (pui) ui.setContentSize(pui.contentSize.width, pui.contentSize.height);
      else ui.setContentSize(2 * OPT_MAX + 80, OPT_MAX + 40);
      ui.setAnchorPoint(0.5, 0.5);
      c.setPosition(0, 0, 0);
      c.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
      c.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
      c.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }
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

  onDestroy() {
    this.unsub?.();
    const c = this.listContent;
    if (c) {
      c.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
      c.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
      c.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }
  }

  // ── Touch: tap one half = select that option; horizontal drag = rotate ──

  private onTouchStart(e: EventTouch) {
    this.touchStartX = e.getUILocation().x;
  }

  private onTouchMove(_e: EventTouch) { /* tracked on end */ }

  private onTouchEnd(e: EventTouch) {
    const card = currentCard(gameStore.getState());
    if (!card) return;
    const dx = e.getUILocation().x - this.touchStartX;
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      // Right swipe = clockwise, left = counter-clockwise.
      gameStore.getState().rotateSelection(dx > 0 ? 1 : -1);
      return;
    }
    // Tap: left half → option 1, right half → option 2.
    const ui = this.listContent.getComponent(UITransform);
    if (!ui) return;
    const p = e.getUILocation();
    const local = ui.convertToNodeSpaceAR(new Vec3(p.x, p.y, 0));
    const optionIndex = local.x < 0 ? 1 : 2;
    gameStore.getState().selectOption({ slot: card.slot, slotIdx: card.slotIdx, optionIndex });
  }

  // ── Render ──

  private rebuild() {
    const c = this.listContent;
    if (!c) return;
    c.removeAllChildren();

    const s = gameStore.getState();
    const card = currentCard(s);
    if (!card) {
      this.showHint(s.activeRoomSlot ? '本房间家具已摆完 — 现在造墙 / 门' : '请选择一个房间');
      return;
    }

    const variant = s.chosenVariants[card.number] ?? 'A';
    const data = cardByNumberVariant(card.number, variant);
    if (!data) return;

    const sel = s.selectedOption;
    const ui = this.listContent.getComponent(UITransform);
    const half = (ui ? ui.contentSize.width : 4 * OPT_MAX) / 4;  // spread across the viewport
    for (const opt of data.options) {
      const isSel = !!sel && sel.slot === card.slot && sel.slotIdx === card.slotIdx &&
                    sel.optionIndex === opt.option_index;
      const x = opt.option_index === 1 ? -half : half;
      this.makeOption(card.number, variant, opt.option_index, x, isSel,
        isSel && sel ? sel.rotation : 0, isSel && sel ? sel.mirrored : false);
    }
  }

  private makeOption(
    number: number, variant: 'A' | 'B', optionIndex: number,
    x: number, selected: boolean, rotation: number, mirrored: boolean,
  ) {
    const node = new Node(`opt${optionIndex}`);
    this.listContent.addChild(node);
    node.setPosition(x, 0, 0);
    node.addComponent(UITransform).setContentSize(OPT_MAX, OPT_MAX);

    // Highlight frame (sized to the image once we know its aspect ratio).
    const frame = new Node('frame');
    node.addChild(frame);
    frame.addComponent(UITransform);
    const fg = frame.addComponent(Graphics);

    // Option image — sized to preserve the source aspect ratio (no distortion);
    // reflects rotation/mirror for live feedback on the selected one.
    const imgNode = new Node('img');
    node.addChild(imgNode);
    const imgUi = imgNode.addComponent(UITransform);
    imgNode.angle = -90 * rotation;
    imgNode.setScale(mirrored ? -1 : 1, 1, 1);
    const sprite = imgNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    const url = `cards/options/${String(number).padStart(2, '0')}_${variant}_opt${optionIndex}/spriteFrame`;
    resources.load(url, SpriteFrame, (err, sf) => {
      if (err || !sf) return;
      sprite.spriteFrame = sf;
      // Fit the longest edge to OPT_MAX while keeping the native aspect ratio.
      const orig = (sf as any).originalSize;
      const nw = orig ? orig.width : sf.rect.width;
      const nh = orig ? orig.height : sf.rect.height;
      const k = OPT_MAX / Math.max(nw, nh);
      const w = Math.max(1, Math.round(nw * k));
      const h = Math.max(1, Math.round(nh * k));
      imgUi.setContentSize(w, h);
      // Draw the frame to match the (un-rotated) image footprint.
      const fw = w + FRAME_PAD * 2, fh = h + FRAME_PAD * 2;
      fg.clear();
      fg.fillColor = selected ? new Color(255, 245, 200, 255) : new Color(250, 245, 235, 255);
      fg.strokeColor = selected ? new Color(210, 160, 40, 255) : new Color(170, 158, 130, 255);
      fg.lineWidth = selected ? 4 : 2;
      fg.rect(-fw / 2, -fh / 2, fw, fh);
      fg.fill();
      fg.stroke();
    });
  }

  private showHint(text: string) {
    const node = new Node('hint');
    this.listContent.addChild(node);
    this.hint = node.addComponent(Label);
    this.hint.string = text;
    this.hint.fontSize = 22;
    this.hint.color = new Color(90, 80, 60, 255);
  }
}
