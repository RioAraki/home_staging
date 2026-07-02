import { _decorator, Component, Label } from 'cc';
import { gameStore } from '../state/gameStore';
const { ccclass, property } = _decorator;

@ccclass('WallModeBanner')
export class WallModeBanner extends Component {
  @property(Label) label!: Label;

  private unsub?: () => void;

  start() {
    this.refresh();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.frontDoorMode !== prev.frontDoorMode ||
          s.windowMode    !== prev.windowMode    ||
          s.demolishMode  !== prev.demolishMode) {
        this.refresh();
      }
    });
  }
  onDestroy() { this.unsub?.(); }

  private refresh() {
    const s = gameStore.getState();
    const singleRoom = !!s.scenario && s.scenario.rooms.length === 1;
    if (s.frontDoorMode) this.set('点击外墙放置大门');
    // 单房间是「只能加窗」的固定模式,不再显示这条提示。
    else if (s.windowMode && !singleRoom) this.set('点击外墙添加/移除窗户');
    // 拆除提示已取消(不再显示「点家具/墙/门/窗拆除」)。
    else if (this.node) this.node.active = false;
  }
  private set(text: string) {
    if (this.label) this.label.string = text;
    if (this.node) this.node.active = true;
  }
}
