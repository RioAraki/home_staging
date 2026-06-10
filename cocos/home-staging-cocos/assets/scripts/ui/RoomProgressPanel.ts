import { _decorator, Component, Node, UITransform, Graphics, Label, Color, Widget } from 'cc';
import { gameStore } from '../state/gameStore';
const { ccclass } = _decorator;

const PANEL_W  = 190;
const ROW_H    = 34;
const PAD      = 10;
const TITLE_H  = 30;

/**
 * Persistent left-side overlay listing every room in the scenario with a
 * live placed/total progress counter. Mounted on the Canvas by GameBootstrap
 * so no scene wiring is needed.
 *
 *   ✓  浴室       3/3   ← green when complete
 *   ◑  起居室     0/4   ← yellow when in progress
 *   ○  卧室       0/2   ← grey when untouched
 */
@ccclass('RoomProgressPanel')
export class RoomProgressPanel extends Component {
  private unsub?: () => void;

  start() {
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setAnchorPoint(0, 1);   // top-left origin so Widget.top/left are intuitive

    const widget = this.node.addComponent(Widget);
    widget.isAlignTop  = true;
    widget.isAlignLeft = true;
    widget.top  = 12;
    widget.left = 12;
    widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

    this.rebuild();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.scenario            !== prev.scenario            ||
          s.placedCardKeys      !== prev.placedCardKeys      ||
          s.skippedCardKeys     !== prev.skippedCardKeys     ||
          s.completedRoomSlots  !== prev.completedRoomSlots  ||
          s.activeRoomSlot      !== prev.activeRoomSlot) {
        this.rebuild();
      }
    });
  }

  onDestroy() { this.unsub?.(); }

  private rebuild() {
    this.node.removeAllChildren();
    const s = gameStore.getState();
    if (!s.scenario) return;

    const rooms    = s.scenario.rooms;
    const panelH   = TITLE_H + rooms.length * ROW_H + PAD * 2;

    const ui = this.node.getComponent(UITransform)!;
    ui.setContentSize(PANEL_W, panelH);

    // Semi-transparent background card
    const bgNode = new Node('bg');
    this.node.addChild(bgNode);
    bgNode.setPosition(PANEL_W / 2, -panelH / 2, 0);
    bgNode.addComponent(UITransform).setContentSize(PANEL_W, panelH);
    const bg = bgNode.addComponent(Graphics);
    bg.fillColor   = new Color(10, 20, 40, 160);
    bg.strokeColor = new Color(255, 255, 255, 35);
    bg.lineWidth   = 1.2;
    bg.roundRect(-PANEL_W / 2, -panelH / 2, PANEL_W, panelH, 8);
    bg.fill();
    bg.stroke();

    // Title: "房间进度" — left-aligned.
    const titleNode = new Node('title');
    this.node.addChild(titleNode);
    titleNode.setPosition(PAD, -(PAD + TITLE_H / 2), 0);
    const titleUi = titleNode.addComponent(UITransform);
    titleUi.setAnchorPoint(0, 0.5);
    const titleLbl = titleNode.addComponent(Label);
    titleLbl.string   = '房间进度';
    titleLbl.fontSize = 18;
    titleLbl.isBold   = true;
    titleLbl.color    = new Color(255, 225, 105, 255);
    titleLbl.horizontalAlign = (Label as any).HorizontalAlign?.LEFT ?? 0;

    // Divider line
    const divNode = new Node('div');
    this.node.addChild(divNode);
    divNode.setPosition(PANEL_W / 2, -(PAD + TITLE_H), 0);
    const divG = divNode.addComponent(Graphics);
    divG.strokeColor = new Color(255, 255, 255, 30);
    divG.lineWidth   = 1;
    divG.moveTo(-PANEL_W / 2 + 8, 0);
    divG.lineTo( PANEL_W / 2 - 8, 0);
    divG.stroke();

    // One row per room
    rooms.forEach((room, idx) => {
      const placed = room.furniture_numbers.filter((_, i) =>
        s.placedCardKeys.has(`${room.slot}:${i}`),
      ).length;
      const done     = s.completedRoomSlots.has(room.slot);
      const isActive = s.activeRoomSlot === room.slot;

      const rowY = -(PAD + TITLE_H + idx * ROW_H + ROW_H / 2);

      // Highlight background for active room
      if (isActive && !done) {
        const hlNode = new Node('hl');
        this.node.addChild(hlNode);
        hlNode.setPosition(PANEL_W / 2, rowY, 0);
        hlNode.addComponent(UITransform).setContentSize(PANEL_W - 4, ROW_H - 4);
        const hlG = hlNode.addComponent(Graphics);
        hlG.fillColor = new Color(255, 225, 105, 20);
        hlG.strokeColor = new Color(255, 225, 105, 60);
        hlG.lineWidth = 1;
        hlG.roundRect(-(PANEL_W - 4) / 2, -(ROW_H - 4) / 2, PANEL_W - 4, ROW_H - 4, 4);
        hlG.fill();
        hlG.stroke();
      }

      const rowNode = new Node(`row_${idx}`);
      this.node.addChild(rowNode);
      rowNode.setPosition(PAD, rowY, 0);
      const rowUi = rowNode.addComponent(UITransform);
      rowUi.setAnchorPoint(0, 0.5);

      // Room name only (per-furniture count is shown in the bottom chooser).
      const icon = done ? '✓' : placed > 0 ? '◑' : '○';
      const lbl  = rowNode.addComponent(Label);
      lbl.string    = `${icon}  ${room.name_zh}`;
      lbl.horizontalAlign = (Label as any).HorizontalAlign?.LEFT ?? 0;
      lbl.fontSize  = 17;
      lbl.color     = done
        ? new Color(100, 220, 130, 255)   // green — complete
        : isActive
          ? new Color(255, 225, 105, 255) // yellow — active
          : placed > 0
            ? new Color(200, 200, 160, 255) // dim yellow — in progress
            : new Color(160, 160, 175, 255); // grey — untouched
    });
  }
}
