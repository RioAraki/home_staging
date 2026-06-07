import {
  _decorator, Component, Node, UITransform, Sprite, SpriteFrame, resources,
  Graphics, Color, Label, EventTouch, director, input, Input,
} from 'cc';
import {
  gameStore, currentCard, getRoomPhase, isActiveRoomEnclosed,
  allRoomsSealed, frontDoorFixed, type GameState,
} from '../state/gameStore';
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
const CONFIRM_X = 300;    // right column: 旋转 / 放置
const LEFT_X    = -390;   // left column:  跳过 / 撤销

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

  /** Resolve the scene's InputHandler lazily (it may not exist at start()). */
  private getInput(): InputHandler | null {
    if (!this.input || !this.input.isValid) {
      this.input = director.getScene()?.getComponentInChildren(InputHandler) ?? null;
    }
    return this.input;
  }

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
    this.getInput();
    this.rebuild();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.scenario           !== prev.scenario           ||
          s.activeRoomSlot     !== prev.activeRoomSlot     ||
          s.placedCardKeys     !== prev.placedCardKeys     ||
          s.skippedCardKeys    !== prev.skippedCardKeys    ||
          s.selectedOption     !== prev.selectedOption     ||
          s.wallPhase          !== prev.wallPhase          ||
          s.windowMode         !== prev.windowMode         ||
          s.walls              !== prev.walls              ||
          s.completedRoomSlots !== prev.completedRoomSlots ||
          s.frontDoorEdge      !== prev.frontDoorEdge      ||
          s.frontDoorMode      !== prev.frontDoorMode      ||
          s.gameFinished       !== prev.gameFinished ||
          s.past.length        !== prev.past.length) {
        this.rebuild();
      }
    });
  }

  onDestroy() {
    this.unsub?.();
    input.off(Input.EventType.TOUCH_MOVE, this.onGlobalMove, this);
  }

  /** Forward a global touch-move (during a tray drag) to the plan's ghost. */
  private onGlobalMove(e: EventTouch) {
    this.getInput()?.dragGhost(e);
  }

  private onGlobalEnd() {
    input.off(Input.EventType.TOUCH_MOVE, this.onGlobalMove, this);
  }

  private rebuild() {
    const c = this.listContent;
    if (!c) return;
    c.removeAllChildren();

    const s = gameStore.getState();
    const card = currentCard(s);
    if (!card) {
      if (allRoomsSealed(s) && !s.gameFinished) {
        this.buildFinishControls(s);
      } else if (s.activeRoomSlot && getRoomPhase(s) === 'construction') {
        this.buildConstructionControls(s);  // adds its own undo internally
      } else {
        this.showHint('请选择一个房间');
      }
      return;
    }

    // ── Room progress badge: "起居室  2 / 3" ────────────────────────────
    if (s.scenario && s.activeRoomSlot) {
      const room = s.scenario.rooms.find(r => r.slot === s.activeRoomSlot);
      if (room) {
        const total = room.furniture_numbers.length;
        // Count resolved cards (placed or skipped) for this room.
        const resolved = room.furniture_numbers.filter((_, i) =>
          s.placedCardKeys.has(`${s.activeRoomSlot}:${i}`) ||
          s.skippedCardKeys.has(`${s.activeRoomSlot}:${i}`),
        ).length;
        const badgeNode = new Node('RoomBadge');
        this.listContent.addChild(badgeNode);
        badgeNode.setPosition(OPT1_X, TITLE_Y + 30, 0);
        const lbl = badgeNode.addComponent(Label);
        lbl.string = `${room.name_zh}  ${resolved} / ${total}`;
        lbl.fontSize = 22;
        lbl.color = new Color(200, 200, 220, 255);
      }
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
    // Left column: secondary actions (跳过 / 撤销)
    // Right column: primary actions (旋转 / 放置)
    // 80px vertical spacing → 16px gap between 64px-tall buttons.
    this.makeButton(LEFT_X,    40, '跳过', new Color(150, 140, 120, 255), true,
      () => gameStore.getState().skipCard(card.slot, card.slotIdx));
    this.addUndoButton(s, LEFT_X, -40);
    this.makeButton(CONFIRM_X, 40, '旋转', new Color(70, 120, 200, 255), !!sel,
      () => gameStore.getState().rotateSelection(1));
    this.makeButton(CONFIRM_X, -40, '放置', new Color(80, 160, 90, 255), !!sel,
      () => this.getInput()?.tryPlaceAtGhost());
  }

  private addUndoButton(s: GameState, x = 0, y = -80) {
    const canUndo = s.past.length > 0;
    this.makeButton(x, y, '撤销', new Color(160, 70, 50, 255), canUndo,
      () => gameStore.getState().undo());   // same default width=110
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
    // Touch-down picks the option up and begins a drag. Cocos does NOT deliver
    // node move events once the finger leaves the small tray slot, so we listen
    // on the GLOBAL input for the rest of the drag and forward it to the plan.
    node.on(Node.EventType.TOUCH_START, () => {
      gameStore.getState().selectOption({ slot, slotIdx, optionIndex });
      input.off(Input.EventType.TOUCH_MOVE, this.onGlobalMove, this);
      input.on(Input.EventType.TOUCH_MOVE, this.onGlobalMove, this);
      input.once(Input.EventType.TOUCH_END, this.onGlobalEnd, this);
      input.once(Input.EventType.TOUCH_CANCEL, this.onGlobalEnd, this);
    });

    // Frame (drawn to the real footprint once we know the cell size). Rotated
    // and mirrored to match the image, so the border turns with the piece.
    const frame = new Node('frame');
    node.addChild(frame);
    frame.addComponent(UITransform);
    frame.angle = -90 * rotation;
    frame.setScale(mirrored ? -1 : 1, 1, 1);
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
    nameLabel.enableOutline = true;
    nameLabel.outlineColor = new Color(0, 0, 0, 230);
    nameLabel.outlineWidth = 2;

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
    w = 110,
  ) {
    const node = new Node(label);
    this.listContent.addChild(node);
    node.setPosition(x, y, 0);
    node.addComponent(UITransform).setContentSize(w, 64);

    const g = node.addComponent(Graphics);
    g.fillColor = enabled ? fill : new Color(170, 170, 170, 255);
    g.roundRect(-w / 2, -32, w, 64, 10);
    g.fill();

    const lblNode = new Node('label');
    node.addChild(lblNode);
    const lbl = lblNode.addComponent(Label);
    lbl.string = label;
    lbl.fontSize = 26;
    lbl.color = new Color(255, 255, 255, 255);

    node.on(Node.EventType.TOUCH_END, () => { if (enabled) onTap(); });
  }

  /** Bottom controls during the construction phase (replaces the chooser).
   *  Step 1 (walls): draw walls on the plan, then 结束砌墙. Step 2 (door/window):
   *  pick 门/窗 to choose what an edge-tap places, then 完成房间. */
  private buildConstructionControls(s: GameState) {
    const GREEN = new Color(80, 160, 90, 255);
    if (s.wallPhase === 'walls') {
      // Only allow finishing walls once the room is actually sealed.
      const enclosed = isActiveRoomEnclosed(s);
      this.makeButton(-60, 0, '结束砌墙', GREEN, enclosed,
        () => gameStore.getState().setWallPhase('door'), 200);
      this.addUndoButton(s, 180, 0);
      return;
    }
    // Door/window step.
    const isWindow = s.windowMode;
    const HL = new Color(70, 120, 200, 255);
    const DIM = new Color(110, 120, 135, 255);
    this.makeButton(-220, 0, '门', isWindow ? DIM : HL, true, () => {
      const st = gameStore.getState(); if (st.windowMode) st.toggleWindowMode();
    });
    this.makeButton(-90, 0, '窗', isWindow ? HL : DIM, true, () => {
      const st = gameStore.getState(); if (!st.windowMode) st.toggleWindowMode();
    });
    this.makeButton(80, 0, '完成房间', GREEN, true,
      () => gameStore.getState().completeRoom(), 180);
    this.addUndoButton(s, 250, 0);
  }

  /** Final stage, shown once every room is sealed: place the building's
   *  front door (大门), then settle. Scoring runs ONLY when 结算 is pressed. */
  private buildFinishControls(s: GameState) {
    const GREEN = new Color(80, 160, 90, 255);
    const BLUE = new Color(70, 120, 200, 255);
    if (!s.frontDoorEdge) {
      // Front door not placed yet — toggle front-door mode and let the player
      // tap an exterior edge (handled by InputHandler → setFrontDoor).
      const label = s.frontDoorMode ? '点外墙设置大门…' : '放大门';
      this.makeButton(0, 30, label, BLUE, true,
        () => gameStore.getState().toggleFrontDoorMode(), 240);
      this.showHint('设置大门后即可结算', -40);
      return;
    }
    // Front door placed → offer 结算. A fixed (scenario-pre-drawn) front door
    // can't be moved; otherwise allow re-placing it.
    if (frontDoorFixed(s)) {
      this.makeButton(0, 0, '结算', GREEN, true,
        () => gameStore.getState().finishGame(), 200);
    } else {
      this.makeButton(-120, 0, '重设大门', BLUE, true,
        () => gameStore.getState().toggleFrontDoorMode(), 160);
      this.makeButton(110, 0, '结算', GREEN, true,
        () => gameStore.getState().finishGame(), 180);
    }
  }

  private showHint(text: string, y = 0) {
    const node = new Node('hint');
    this.listContent.addChild(node);
    node.setPosition(0, y, 0);
    const hint = node.addComponent(Label);
    hint.string = text;
    hint.fontSize = 22;
    hint.color = new Color(90, 80, 60, 255);
  }
}
