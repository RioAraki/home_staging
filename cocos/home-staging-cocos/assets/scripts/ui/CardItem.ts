import { _decorator, Component, Node, Label, Sprite, SpriteFrame, UITransform, Color, resources, Layout, Graphics } from 'cc';
import { gameStore, instanceKey } from '../state/gameStore';
import { cardByNumberVariant } from '../core/dataLoader';
import type { RoomSlot } from '../core/types';
const { ccclass } = _decorator;

@ccclass('CardItem')
export class CardItem extends Component {
  private slot!: RoomSlot;
  private slotIdx!: number;
  private number!: number;
  private numberLabel!: Label;
  private optionRow!: Node;
  private unsub?: () => void;
  private revealHandler?: (...args: any[]) => void;

  onLoad() {
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setContentSize(160, 180);

    // Background — draw via Graphics since Sprite without SpriteFrame doesn't render
    const bg = new Node('Bg');
    this.node.addChild(bg);
    const bgUi = bg.addComponent(UITransform);
    bgUi.setContentSize(160, 180);
    const bgGfx = bg.addComponent(Graphics);
    bgGfx.fillColor = new Color(245, 240, 230, 255);
    bgGfx.strokeColor = new Color(180, 170, 150, 255);
    bgGfx.lineWidth = 2;
    bgGfx.rect(-80, -90, 160, 180);
    bgGfx.fill();
    bgGfx.stroke();

    // Number label
    const labelNode = new Node('NumberLabel');
    this.node.addChild(labelNode);
    labelNode.setPosition(0, 60, 0);
    this.numberLabel = labelNode.addComponent(Label);
    this.numberLabel.string = '?';
    this.numberLabel.fontSize = 28;
    this.numberLabel.color = new Color(60, 60, 60, 255);

    // Option row
    this.optionRow = new Node('OptionRow');
    this.node.addChild(this.optionRow);
    this.optionRow.setPosition(0, -50, 0);
    const rowUi = this.optionRow.addComponent(UITransform);
    rowUi.setContentSize(140, 50);
    const layout = this.optionRow.addComponent(Layout);
    layout.type = Layout.Type.HORIZONTAL;
    layout.spacingX = 4;
    layout.resizeMode = Layout.ResizeMode.CONTAINER;
  }

  init(slot: RoomSlot, slotIdx: number, number: number) {
    this.slot = slot;
    this.slotIdx = slotIdx;
    this.number = number;
    this.refresh();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.revealedCardKeys !== prev.revealedCardKeys ||
          s.chosenVariants   !== prev.chosenVariants ||
          s.placedCardKeys   !== prev.placedCardKeys   ||
          s.skippedCardKeys  !== prev.skippedCardKeys  ||
          s.selectedOption   !== prev.selectedOption) {
        this.refresh();
      }
    });
  }

  onDestroy() {
    this.unsub?.();
    if (this.revealHandler) this.node.off(Node.EventType.TOUCH_END, this.revealHandler, this);
  }

  private refresh() {
    const s = gameStore.getState();
    const key = instanceKey(this.slot, this.slotIdx);
    const revealed = s.revealedCardKeys.has(key);
    const placed = s.placedCardKeys.has(key);
    const skipped = s.skippedCardKeys.has(key);

    this.optionRow.removeAllChildren();
    if (this.revealHandler) {
      this.node.off(Node.EventType.TOUCH_END, this.revealHandler, this);
      this.revealHandler = undefined;
    }

    if (placed) {
      this.numberLabel.string = `#${this.number} OK`;
      return;
    }
    if (skipped) {
      this.numberLabel.string = `#${this.number} -`;
      return;
    }
    if (!revealed) {
      this.numberLabel.string = `#${this.number}`;
      this.revealHandler = () => this.onReveal();
      this.node.on(Node.EventType.TOUCH_END, this.revealHandler, this);
      return;
    }

    const variant = s.chosenVariants[this.number] ?? 'A';
    const card = cardByNumberVariant(this.number, variant);
    if (!card) return;
    this.numberLabel.string = `#${this.number}${variant}`;

    for (const opt of card.options) {
      const btnNode = new Node(`opt${opt.option_index}`);
      this.optionRow.addChild(btnNode);
      const btnUi = btnNode.addComponent(UITransform);
      btnUi.setContentSize(40, 40);
      const sprite = btnNode.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      const url = `cards/options/${String(this.number).padStart(2, '0')}_${variant}_opt${opt.option_index}/spriteFrame`;
      resources.load(url, SpriteFrame, (err, sf) => {
        if (!err && sf) {
          sprite.spriteFrame = sf;
          // Re-enforce custom size after spriteFrame assigned (it may reset)
          btnUi.setContentSize(40, 40);
        }
      });
      btnNode.on(Node.EventType.TOUCH_END, () => {
        gameStore.getState().selectOption({
          slot: this.slot, slotIdx: this.slotIdx, optionIndex: opt.option_index,
        });
      });
    }
  }

  private onReveal() {
    if (gameStore.getState().activeRoomSlot !== this.slot) {
      gameStore.getState().selectRoom(this.slot);
    }
    gameStore.getState().revealCard(this.slot, this.slotIdx);
  }
}
