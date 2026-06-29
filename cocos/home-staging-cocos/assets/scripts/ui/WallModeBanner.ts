import { _decorator, Component, Label } from 'cc';
import { gameStore } from '../state/gameStore';
import { TutorialController } from './TutorialController';
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
    if (s.frontDoorMode) this.set('点击外墙放置大门');
    else if (s.windowMode) this.set('点击外墙添加/移除窗户');
    // 教程进行时让位给教程气泡,不显示拆除提示。
    else if (s.demolishMode && !TutorialController.instance?.isRunning()) this.set('点家具 / 墙 / 门 / 窗 拆除');
    else if (this.node) this.node.active = false;
  }
  private set(text: string) {
    if (this.label) this.label.string = text;
    if (this.node) this.node.active = true;
  }
}
