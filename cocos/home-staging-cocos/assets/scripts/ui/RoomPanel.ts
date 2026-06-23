import {
  _decorator, Component, Node, UITransform, Sprite, SpriteFrame, resources,
  Graphics, Color, Label, EventTouch, director, input, Input, view, UIOpacity, Mask, ScrollView, Vec2,
} from 'cc';
import {
  gameStore, currentCard, getRoomPhase, isActiveRoomEnclosed,
  allRoomsSealed, frontDoorFixed, type GameState,
} from '../state/gameStore';
import { cardByNumberVariant, furnitureByName, type FurnitureLibraryEntry } from '../core/dataLoader';
import { roomItemCount, roomItemAt } from '../core/roomItems';
import { resolveOption } from '../core/pieces';
import { InputHandler } from './InputHandler';
import {
  PANEL, PANEL_LINE as TOKEN_PANEL_LINE, ACCENT, ACCENT_DARK,
  CARD_FILL, CARD_LINE, CARD_NAME, BTN_GREEN, BTN_RED, BTN_PRIMARY,
} from './uiTheme';
const { ccclass, property } = _decorator;

const PX_PER_CELL = 52;       // shared cells→px scale so footprints are comparable
const SLOT_W = 240;           // fixed hit/layout slot per option
const SLOT_H = 240;
const FRAME_PAD = 8;
const MAX_FOOTPRINT_CELLS = 4;  // tallest furniture bbox dimension in the data
// Single shared title line for ALL options — sits above the tallest piece so
// every name aligns horizontally regardless of its image size.
const TITLE_Y = (MAX_FOOTPRINT_CELLS * PX_PER_CELL) / 2 + 18;
// Three-column layout with equal inter-column spacing.
// Options are centred around x=0; buttons pulled in from the edges so they
// stay within the canvas on narrow mobile screens (canvas half-width ≈ 375px,
// button half-width = 55px → minimum edge gap = 375-280-55 = 40px).
const OPT1_X    = -120;   // centre of first option slot
const OPT2_X    =  120;   // centre of second option slot
const BTN_W     =  110;   // action-button width
const PALETTE_CARD = 160; // uniform palette card box (tapOnly) — B4 orderly row
const DRAG_THRESHOLD = 12; // px before a tray touch counts as a drag (vs a tap)

// ── Shared UI color tokens (C2) so blocks stay visually consistent. ──
// Bright "暖沙" theme: the tray reads as a light cream block (see uiTheme).
const PANEL_FILL = PANEL;             // light cream block background
const PANEL_LINE = TOKEN_PANEL_LINE;  // block border / divider

/** X of the right-hand action column, pinned to the VISIBLE right edge so it
 *  never clips on narrow / tall phones (where the design width exceeds the
 *  visible width under a fit-height resolution policy). listContent is centred
 *  on screen, so local x=0 is screen centre. */
function rightColumnX(): number {
  const visW = view.getVisibleSize().width;
  return visW / 2 - BTN_W / 2 - 16;   // 16px margin from the screen edge
}

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
  /** Preserved horizontal scroll offset of the palette strip, so a rebuild
   *  (which happens on nearly every store change) doesn't jump it back to the
   *  first card. Reset to 0 only when the active room changes. */
  private scrollX = 0;
  private scrollRoomSlot: any = null;

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
    this.offGlobalListeners();
  }

  /** Forward a global touch-move (during a tray drag) to the plan's ghost. */
  private onGlobalMove(e: EventTouch) {
    this.getInput()?.dragGhost(e);
  }

  /** Remove ALL global drag listeners. The end/cancel pair is registered with
   *  `once`, but only one of them fires — the sibling registration must be
   *  removed by hand or it keeps referencing this component forever. */
  private offGlobalListeners() {
    input.off(Input.EventType.TOUCH_MOVE,   this.onGlobalMove, this);
    input.off(Input.EventType.TOUCH_END,    this.onGlobalEnd,  this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onGlobalEnd,  this);
    input.off(Input.EventType.TOUCH_END,    this.onGlobalDrop, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onGlobalDrop, this);
  }

  private onGlobalEnd() {
    this.offGlobalListeners();
  }

  /** Begin a tray→plan drag: forward global touch-moves to the plan ghost, and
   *  on release drop-to-place (so dragging a card onto a cell places it). */
  private beginTrayDrag() {
    input.off(Input.EventType.TOUCH_MOVE, this.onGlobalMove, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onGlobalMove, this);
    input.once(Input.EventType.TOUCH_END,    this.onGlobalDrop, this);
    input.once(Input.EventType.TOUCH_CANCEL, this.onGlobalDrop, this);
  }

  private onGlobalDrop(e: EventTouch) {
    this.offGlobalListeners();
    const inp = this.getInput();
    if (!inp) return;
    inp.dragGhost(e);        // settle the ghost at the release point
    inp.tryPlaceAtGhost();   // place if valid (invalid → stays selected + shows why)
  }

  private rebuild() {
    const c = this.listContent;
    if (!c) return;
    // Preserve the palette strip's scroll position across this rebuild (which
    // runs on nearly every store change) — capture it before the old strip is
    // destroyed, so selecting a card further down doesn't jump back to the first.
    const prevSv = c.getChildByName('PaletteView')?.getComponent(ScrollView);
    if (prevSv) this.scrollX = prevSv.getScrollOffset().x;
    // destroy (not just detach) — rebuild() runs on nearly every store change.
    c.destroyAllChildren();

    const s = gameStore.getState();
    // A different room starts its palette at the beginning.
    if (s.activeRoomSlot !== this.scrollRoomSlot) {
      this.scrollX = 0;
      this.scrollRoomSlot = s.activeRoomSlot;
    }
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

    // ── Room header: title + progress, centred above the option slots ───
    if (s.scenario && s.activeRoomSlot) {
      const room = s.scenario.rooms.find(r => r.slot === s.activeRoomSlot);
      if (room) {
        const total = roomItemCount(room);
        const resolved = Array.from({ length: total }, (_, i) => i).filter((i) =>
          s.placedCardKeys.has(`${s.activeRoomSlot}:${i}`) ||
          s.skippedCardKeys.has(`${s.activeRoomSlot}:${i}`),
        ).length;

        // Room name + progress badge above the strip. No decorative frame —
        // the old OptionsFrame was sized for the 2-option chooser and only
        // covered the centre; the palette now spans the full tray width.
        const badgeNode = new Node('RoomBadge');
        this.listContent.addChild(badgeNode);
        badgeNode.setPosition(0, TITLE_Y + 30, 0);
        const lbl = badgeNode.addComponent(Label);
        lbl.string = `${room.name_zh}  ${resolved} / ${total}`;
        lbl.fontSize = 24;
        lbl.isBold = true;
        lbl.color = ACCENT_DARK;
      }
    }

    // ── Free-selection palette: ALL of the room's furniture as a horizontally
    // scrollable strip. Tap any unplaced card to select it (drag to the plan /
    // press 放置 to commit); placed cards grey out with a ✓. 「完成摆放」 finishes
    // the room (skips whatever is left → construction). 「跳过」 is gone — free
    // order makes per-card skipping meaningless. Cards live in listContent (the
    // ScrollView content); the action buttons live on its parent so they stay
    // put while the strip scrolls.
    const sel = s.selectedOption;
    const slot = card.slot;
    const room2 = s.scenario?.rooms.find(r => r.slot === slot);
    const total2 = room2 ? roomItemCount(room2) : 0;

    const cardList = this.listContent.parent!;
    // Self-contained viewport pinned to the LEFT zone: the strip is clipped to
    // ~3-4 cards and scrolls horizontally; the action buttons get a clear right
    // zone so they never overlap the cards. (cardList's own ScrollView/Mask off.)
    const m0 = cardList.getComponent('cc.Mask' as any) as any; if (m0) m0.enabled = false;
    const sv0 = cardList.getComponent('cc.ScrollView' as any) as any; if (sv0) sv0.enabled = false;
    // Buttons now live in listContent (cleared every rebuild); drop any stragglers
    // a previous build may have left on cardList so they can't pile up.
    for (const c of [...cardList.children]) if (c !== this.listContent) c.destroy();

    const visW = view.getVisibleSize().width;
    const BTN_ZONE = 180;                                   // right zone reserved for buttons
    const viewW = Math.max(300, visW - BTN_ZONE - 16);      // strip viewport width (~3-4 cards)
    const GAP = 210;                                        // x spacing between card slots

    // Taller than SLOT_H so the name label (sits above the image at ~+122) is
    // not clipped by the viewport Mask.
    const viewH = SLOT_H + 160;

    // B3: a dark rounded "palette panel" behind the tray so it reads as one
    // defined block (TOKENs: panel fill/line) instead of loose elements on black.
    const panel = new Node('TrayPanel');
    this.listContent.addChild(panel);
    panel.setSiblingIndex(0);                               // behind badge / cards / buttons
    const panelW = visW - 18, panelH = viewH + 60;
    panel.setPosition(0, 0, 0);
    panel.addComponent(UITransform).setContentSize(panelW, panelH);
    const pg = panel.addComponent(Graphics);
    pg.fillColor = PANEL_FILL;
    pg.roundRect(-panelW / 2, -panelH / 2, panelW, panelH, 16); pg.fill();
    pg.strokeColor = PANEL_LINE; pg.lineWidth = 1.5;
    pg.roundRect(-panelW / 2, -panelH / 2, panelW, panelH, 16); pg.stroke();

    const viewport = new Node('PaletteView');
    this.listContent.addChild(viewport);
    viewport.setPosition(-visW / 2 + viewW / 2 + 8, 0, 0);
    viewport.addComponent(UITransform).setContentSize(viewW, viewH);
    viewport.addComponent(Mask);
    const psv = viewport.addComponent(ScrollView);

    const strip = new Node('strip');
    viewport.addChild(strip);
    const sui = strip.addComponent(UITransform);
    sui.setAnchorPoint(0, 0.5);
    sui.setContentSize(Math.max(viewW, total2 * GAP), viewH);
    strip.setPosition(-viewW / 2, 0, 0);                    // content left edge at viewport left
    psv.horizontal = true; psv.vertical = false; psv.content = strip;
    // Track scrolling so the offset is current for the next rebuild, and restore
    // the preserved offset now so this rebuild keeps the strip where it was.
    psv.node.on(ScrollView.EventType.SCROLLING, () => { this.scrollX = psv.getScrollOffset().x; }, this);
    if (this.scrollX) psv.scrollToOffset(new Vec2(this.scrollX, 0), 0);

    for (let i = 0; i < total2 && room2; i++) {
      const item = roomItemAt(room2, i);
      if (!item) continue;
      const x = i * GAP + GAP / 2;                          // from the strip's left-anchored origin
      const resolved = s.placedCardKeys.has(`${slot}:${i}`) || s.skippedCardKeys.has(`${slot}:${i}`);
      const isSel = !!sel && sel.slot === slot && sel.slotIdx === i;
      const selRot = isSel && sel ? sel.rotation : 0;
      const selMir = isSel && sel ? sel.mirrored : false;
      if (item.kind === 'named') {
        const e = furnitureByName(item.name);
        if (e) this.makeOption(slot, i, e.number ?? 0, e.variant ?? 'A', e.option_index ?? 1,
          e.bbox, item.name, x, isSel, selRot, selMir,
          e.source === 'custom' ? e : null, strip, resolved, true);
      } else {
        const variant = s.chosenVariants[item.number] ?? 'A';
        const data = cardByNumberVariant(item.number, variant);
        const opt = data?.options?.[0];
        if (opt) this.makeOption(slot, i, item.number, variant, opt.option_index,
          opt.bbox, opt.name_zh, x, isSel, selRot, selMir, null, strip, resolved, true);
      }
    }

    // Right-hand action column on cardList (outside the viewport — never clipped
    // or scrolled). 放置 / 撤销 / 完成摆放 (跳过 removed).
    const rx = visW / 2 - BTN_ZONE / 2;
    this.makeButton(rx,  80, '放置', BTN_GREEN, !!sel,
      () => this.getInput()?.tryPlaceAtGhost(), 120, this.listContent);
    this.makeButton(rx,   0, '撤销', BTN_RED, s.past.length > 0,
      () => gameStore.getState().undo(), 120, this.listContent);
    this.makeButton(rx, -80, '完成摆放', BTN_PRIMARY, true,
      () => gameStore.getState().finishPlacing(), 120, this.listContent);
  }

  private addUndoButton(s: GameState, x = 0, y = -80) {
    const canUndo = s.past.length > 0;
    this.makeButton(x, y, '撤销', BTN_RED, canUndo,
      () => gameStore.getState().undo());   // same default width=110
  }

  private makeOption(
    slot: any, slotIdx: number, number: number, variant: 'A' | 'B', optionIndex: number,
    bbox: [number, number], name: string, x: number, selected: boolean,
    rotation: number, mirrored: boolean,
    customEntry: FurnitureLibraryEntry | null = null,
    parent: Node = this.listContent, dimmed = false, tapOnly = false,
  ) {
    const node = new Node(`opt${optionIndex}`);
    parent.addChild(node);
    node.setPosition(x, 0, 0);
    node.addComponent(UITransform).setContentSize(SLOT_W, SLOT_H);  // fixed hit area

    // Make the selected palette card unmistakable: lift it slightly and draw a
    // terracotta glow ring behind it (the card border also thickens to ACCENT).
    if (selected && tapOnly) {
      node.setScale(1.06, 1.06, 1);
      const glow = new Node('glow');
      node.addChild(glow);
      glow.setSiblingIndex(0);   // behind the card frame / art
      const gg = glow.addComponent(Graphics);
      const gs = PALETTE_CARD + 16;
      gg.fillColor = new Color(ACCENT.r, ACCENT.g, ACCENT.b, 80);
      gg.roundRect(-gs / 2, -gs / 2, gs, gs, 18);
      gg.fill();
    }

    if (dimmed) {
      // Placed/resolved card: greyed and inert (a ✓ badge is drawn on top).
      (node.addComponent(UIOpacity)).opacity = 110;
    } else if (tapOnly) {
      // Inside the scrollable palette:
      //  • TAP → select this furniture (then 放置, or drag it onto the plan);
      //  • VERTICAL drag (up toward the plan) → pick it up and drag a ghost onto
      //    the floor plan, dropping to place. The strip is horizontal-only, so a
      //    vertical drag never fights the scroll;
      //  • HORIZONTAL drag → left to the ScrollView so the strip scrolls.
      let sx = 0, sy = 0, mode: 'none' | 'scroll' | 'drag' = 'none';
      node.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
        const p = e.getUILocation(); sx = p.x; sy = p.y; mode = 'none';
      });
      node.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
        const p = e.getUILocation();
        const dx = p.x - sx, dy = p.y - sy;
        if (mode === 'none') {
          if (Math.hypot(dx, dy) <= DRAG_THRESHOLD) return;
          if (Math.abs(dy) > Math.abs(dx)) {
            mode = 'drag';
            gameStore.getState().selectOption({ slot, slotIdx, optionIndex });
            this.beginTrayDrag();
          } else {
            mode = 'scroll';   // let the ScrollView scroll the strip
            return;
          }
        }
        if (mode === 'drag') { e.propagationStopped = true; this.getInput()?.dragGhost(e); }
      });
      node.on(Node.EventType.TOUCH_END, () => {
        if (mode === 'none') gameStore.getState().selectOption({ slot, slotIdx, optionIndex });
      });
    } else {
      // Old 2-option chooser: touch-down picks the option up and drags it onto
      // the floor plan (the ghost follows the finger via the GLOBAL input).
      node.on(Node.EventType.TOUCH_START, () => {
        gameStore.getState().selectOption({ slot, slotIdx, optionIndex });
        input.off(Input.EventType.TOUCH_MOVE, this.onGlobalMove, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onGlobalMove, this);
        input.once(Input.EventType.TOUCH_END, this.onGlobalEnd, this);
        input.once(Input.EventType.TOUCH_CANCEL, this.onGlobalEnd, this);
      });
    }

    // Frame (drawn to the real footprint once we know the cell size). Rotated
    // and mirrored to match the image, so the border turns with the piece.
    const frame = new Node('frame');
    node.addChild(frame);
    frame.addComponent(UITransform);
    frame.angle = -90 * rotation;
    frame.setScale(mirrored ? -1 : 1, 1, 1);
    const fg = frame.addComponent(Graphics);

    // In the palette every card is a uniform square (B4) so the strip reads as
    // an orderly row, with the art scaled to fit. Only the old 2-option chooser
    // keeps footprint-proportional sizing (1x1 renders 1/9 the area of a 3x3).
    const boxW = tapOnly ? PALETTE_CARD : bbox[1] * PX_PER_CELL;
    const boxH = tapOnly ? PALETTE_CARD : bbox[0] * PX_PER_CELL;

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
    // Dark text on the cream tray; selected pops to terracotta. Light outline so
    // it stays legible where the name overlaps the dark card thumbnail.
    nameLabel.color = selected ? ACCENT_DARK : CARD_NAME;
    nameLabel.enableOutline = true;
    nameLabel.outlineColor = new Color(253, 246, 236, 235);
    nameLabel.outlineWidth = 2;

    // 方案 B: a small footprint badge in the card's bottom-right corner showing
    // the piece's bbox — shape cells, open cells, voids — so the player can read
    // its size/shape at a glance without losing the recognizable illustration.
    if (tapOnly) this.addFootprintBadge(node, number, variant, optionIndex, name);

    if (customEntry) {
      // Custom furniture: navy frame + composited tile sprites (resources/tiles).
      const boxW2 = bbox[1] * PX_PER_CELL, boxH2 = bbox[0] * PX_PER_CELL;
      const fw = tapOnly ? PALETTE_CARD : boxW2 + FRAME_PAD * 2;
      const fh = tapOnly ? PALETTE_CARD : boxH2 + FRAME_PAD * 2;
      fg.clear();
      fg.fillColor = CARD_FILL;
      fg.strokeColor = selected ? ACCENT : CARD_LINE;
      fg.lineWidth = selected ? 4 : 2;
      fg.roundRect(-fw / 2, -fh / 2, fw, fh, 12);
      fg.fill();
      fg.stroke();
      imgUi.setContentSize(boxW2, boxH2);  // imgNode already carries rotation/mirror
      if (tapOnly) {
        // Scale the footprint tile-composite to fit the uniform card box (B4).
        const fit = (PALETTE_CARD - FRAME_PAD * 2) / Math.max(boxW2, boxH2, 1);
        imgNode.setScale((mirrored ? -1 : 1) * fit, fit, 1);
      }
      for (const tile of customEntry.tiles ?? []) {
        const tn = new Node('t');
        imgNode.addChild(tn);
        tn.addComponent(UITransform).setContentSize(PX_PER_CELL, PX_PER_CELL);
        tn.setPosition(tile.col * PX_PER_CELL + PX_PER_CELL / 2 - boxW2 / 2, boxH2 / 2 - (tile.row * PX_PER_CELL + PX_PER_CELL / 2), 0);
        tn.angle = -(tile.rotation ?? 0);
        tn.setScale(tile.mirror ? -1 : 1, 1, 1);
        const ts = tn.addComponent(Sprite);
        ts.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load(`tiles/${tile.tile}/spriteFrame`, SpriteFrame, (e, sf) => {
          if (!e && sf && tn.isValid) ts.spriteFrame = sf;
        });
      }
      return;
    }
    const url = `cards/vector/${String(number).padStart(2, '0')}_${variant}_opt${optionIndex}/spriteFrame`;
    resources.load(url, SpriteFrame, (err, sf) => {
      // The option nodes are rebuilt on every store change — the load may
      // resolve after this node was destroyed.
      if (err || !sf || !imgNode.isValid) return;
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
      const fw = tapOnly ? PALETTE_CARD : w + FRAME_PAD * 2;
      const fh = tapOnly ? PALETTE_CARD : h + FRAME_PAD * 2;
      fg.clear();
      // Dark espresso fill so the white line-art reads on the bright tray;
      // terracotta stroke when selected.
      fg.fillColor = CARD_FILL;
      fg.strokeColor = selected ? ACCENT : CARD_LINE;
      fg.lineWidth = selected ? 4 : 2;
      fg.roundRect(-fw / 2, -fh / 2, fw, fh, 12);
      fg.fill();
      fg.stroke();
    });
  }

  /** 方案 B footprint badge: a tiny bbox grid (shape / open cell / void) drawn in
   *  the card's bottom-right corner so the piece's size & shape read at a glance
   *  without losing the recognizable illustration. */
  private addFootprintBadge(
    parent: Node, number: number, variant: 'A' | 'B', optionIndex: number, name?: string,
  ) {
    const ref = { number, variant, optionIndex, rotation: 0 as const, mirrored: false };
    // Numbered & card-derived named pieces resolve by number/variant/option;
    // custom pieces (number 0) only resolve by their library name.
    const opt = resolveOption(ref) ?? (name ? resolveOption({ ...ref, name }) : null);
    if (!opt) return;
    const [H, W] = opt.bbox;
    if (!H || !W) return;

    const shapeSet = new Set(opt.shape.map(([r, c]) => `${r},${c}`));
    const openSet  = new Set(opt.open_spaces.map(([r, c]) => `${r},${c}`));

    const cellPx = Math.max(7, Math.min(11, Math.floor(54 / Math.max(H, W))));
    const bw = W * cellPx, bh = H * cellPx, pad = 3;

    const badge = new Node('footprint');
    parent.addChild(badge);
    // Bottom-right corner of the uniform card (frame spans ±PALETTE_CARD/2).
    const half = PALETTE_CARD / 2;
    badge.setPosition(half - (bw / 2 + pad) - 6, -half + (bh / 2 + pad) + 6, 0);
    badge.addComponent(UITransform).setContentSize(bw + pad * 2, bh + pad * 2);
    const g = badge.addComponent(Graphics);

    // Light translucent backing so the grid reads on the dark walnut card.
    g.fillColor = new Color(231, 217, 191, 235);
    g.roundRect(-(bw / 2 + pad), -(bh / 2 + pad), bw + pad * 2, bh + pad * 2, 4);
    g.fill();

    const SHAPE = new Color(138, 111, 82, 255);   // occupied cell
    const gap = 0.6;
    const dotR = Math.max(2, cellPx * 0.32);
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const k = `${r},${c}`;
        const isShape = shapeSet.has(k), isOpen = openSet.has(k);
        if (isShape) {
          // occupied cell → solid brown square
          g.fillColor = SHAPE;
          g.rect(-bw / 2 + c * cellPx + gap, bh / 2 - (r + 1) * cellPx + gap, cellPx - gap * 2, cellPx - gap * 2);
          g.fill();
        } else if (isOpen) {
          // open / clearance cell → a terracotta dot (matches the floor-plan
          // open-cell dots), so empty cells are marked rather than left blank.
          g.fillColor = ACCENT;
          g.circle(-bw / 2 + (c + 0.5) * cellPx, bh / 2 - (r + 0.5) * cellPx, dotR);
          g.fill();
        }
        // void (neither shape nor open) → leave the light backing
      }
    }
  }

  private makeButton(
    x: number, y: number, label: string, fill: Color, enabled: boolean, onTap: () => void,
    w = 110, parent: Node = this.listContent,
  ) {
    const node = new Node(label);
    parent.addChild(node);
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
    const GREEN = BTN_GREEN;
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
    const GREEN = BTN_GREEN;
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
