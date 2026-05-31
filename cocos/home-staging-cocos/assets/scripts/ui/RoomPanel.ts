import { _decorator, Component, Node, UITransform, Layout } from 'cc';
import { gameStore } from '../state/gameStore';
import { CardItem } from './CardItem';
import type { RoomSlot } from '../core/types';
const { ccclass, property } = _decorator;

@ccclass('RoomPanel')
export class RoomPanel extends Component {
  @property(Node) listContent!: Node;

  private unsub?: () => void;

  start() {
    if (this.listContent) {
      const ui = this.listContent.getComponent(UITransform) ?? this.listContent.addComponent(UITransform);
      ui.setContentSize(5000, 180);
      const layout = this.listContent.getComponent(Layout) ?? this.listContent.addComponent(Layout);
      layout.type = Layout.Type.HORIZONTAL;
      layout.spacingX = 8;
      layout.resizeMode = Layout.ResizeMode.NONE;
    }
    this.rebuild();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.scenario !== prev.scenario) this.rebuild();
    });
  }

  onDestroy() { this.unsub?.(); }

  private rebuild() {
    const s = gameStore.getState();
    if (!s.scenario || !this.listContent) return;
    this.listContent.removeAllChildren();

    for (const room of s.scenario.rooms) {
      for (let i = 0; i < room.furniture_numbers.length; i++) {
        const node = new Node(`Card_${room.slot}_${i}`);
        this.listContent.addChild(node);
        const card = node.addComponent(CardItem);
        card.init(room.slot as RoomSlot, i, room.furniture_numbers[i]);
      }
    }
  }
}
