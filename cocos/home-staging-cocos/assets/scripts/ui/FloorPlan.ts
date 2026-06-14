import { _decorator, Component, Graphics, Node, UITransform, view, Label, Color } from 'cc';
import { gameStore, getRoomPhase, isActiveRoomEnclosed, shouldSuppressOpenCellCheck } from '../state/gameStore';
import { drawGridBg, drawWalls, drawDoors, drawWindows, drawPreDrawn, drawCellWash } from './LayerRenderer';
import { analyseAccessibility, isRoomAccessible, computeFloorReachability } from '../core/regions';
import type { RoomSlot } from '../core/types';
import { computeLayout, setLayout, layout, edgeX, edgeY, LABEL_GAP } from './viewport';
import { PlacedPiece } from './PlacedPiece';
import { pieceOpenSpaceCells } from '../core/pieces';
const { ccclass, property } = _decorator;

@ccclass('FloorPlan')
export class FloorPlan extends Component {
  @property(Node) gridBg!: Node;
  @property(Node) preDrawnLayer!: Node;
  @property(Node) placedLayer!: Node;
  @property(Node) wallsLayer!: Node;
  @property(Node) doorsLayer!: Node;
  @property(Node) windowsLayer!: Node;

  private unsub?: () => void;
  private labelsNode?: Node;
  private blockedLayer?: Node;
  private inaccessibleLayer?: Node;

  start() {
    this.renderAll();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.scenario !== prev.scenario) this.renderAll();
      if (s.placedPieces !== prev.placedPieces) { this.rebuildPlacedLayer(); this.redrawWalls(); this.redrawDoors(); this.redrawBlocked(); this.redrawInaccessibleOpen(); }
      if (s.walls !== prev.walls) { this.redrawWalls(); this.redrawDoors(); this.redrawBlocked(); this.redrawInaccessibleOpen(); }
      if (s.doors !== prev.doors) { this.redrawDoors(); this.redrawWalls(); this.redrawBlocked(); this.redrawInaccessibleOpen(); }
      if (s.windows !== prev.windows) this.redrawWindows();
      // The front door punches a gap in the exterior wall (grid bg) and draws
      // its symbol in the doors layer. Both red-wash overlays depend on it
      // too: redrawBlocked flags sealed rooms unreachable from it, and
      // redrawInaccessibleOpen seeds its BFS from it.
      if (s.frontDoorEdge !== prev.frontDoorEdge) {
        this.redrawGrid(); this.redrawDoors();
        this.redrawBlocked(); this.redrawInaccessibleOpen();
      }
      // Sealing/un-sealing a room can block a previously-built room.
      if (s.completedRoomSlots !== prev.completedRoomSlots) this.redrawBlocked();
      // Wall colour depends on enclosure + phase + active room.
      if (s.wallPhase !== prev.wallPhase || s.activeRoomSlot !== prev.activeRoomSlot) {
        this.redrawWalls();
        if (s.wallPhase !== prev.wallPhase) this.redrawInaccessibleOpen();
      }
    });
  }

  onDestroy() { this.unsub?.(); }

  /** Available area to fit the map into: the FloorPlan's parent container, or
   *  a fraction of the visible screen if the parent isn't sized. */
  private availSize(): { w: number; h: number } {
    const parentUi = this.node.parent?.getComponent(UITransform);
    if (parentUi && parentUi.contentSize.width > 0 && parentUi.contentSize.height > 0) {
      return { w: parentUi.contentSize.width, h: parentUi.contentSize.height };
    }
    const vis = view.getVisibleSize();
    // Fallback: leave room for the top toolbar and bottom card tray.
    return { w: vis.width, h: vis.height * 0.55 };
  }

  private applyLayout() {
    const s = gameStore.getState();
    if (!s.scenario) return;
    const { w, h } = this.availSize();
    setLayout(computeLayout(s.scenario, w, h));
    // Match the node's own hit/visual area to the cropped map (anchor 0.5).
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setContentSize(layout().w, layout().h);
  }

  private renderAll() {
    const s = gameStore.getState();
    if (!s.scenario) return;
    this.applyLayout();
    this.redrawGrid();
    const pg = this.preDrawnLayer?.getComponent(Graphics);
    if (pg) drawPreDrawn(pg, s.scenario);
    this.buildLabels();
    this.rebuildPlacedLayer();
    this.redrawWalls();
    this.redrawDoors();
    this.redrawWindows();
    this.redrawBlocked();
    this.redrawInaccessibleOpen();
  }

  private redrawGrid() {
    const s = gameStore.getState();
    const g = this.gridBg?.getComponent(Graphics);
    if (g && s.scenario) drawGridBg(g, s.scenario, s.frontDoorEdge);
  }

  /** Rebuild the A–P (columns) / 1–16 (rows) axis labels in the grid margins. */
  private buildLabels() {
    if (!this.labelsNode || !this.labelsNode.isValid) {
      this.labelsNode = new Node('Labels');
      this.node.addChild(this.labelsNode);
    }
    this.labelsNode.destroyAllChildren();

    const { cell, r0, c0, rows, cols } = layout();
    const fontSize = Math.round(Math.max(12, Math.min(22, cell * 0.4)));
    const white = new Color(255, 255, 255, 255);

    const addLabel = (text: string, x: number, y: number) => {
      const n = new Node('axis');
      this.labelsNode!.addChild(n);
      n.setPosition(x, y, 0);
      const lbl = n.addComponent(Label);
      lbl.string = text;
      lbl.fontSize = fontSize;
      lbl.lineHeight = fontSize;
      lbl.isItalic = true;
      lbl.color = white;
      lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
      lbl.verticalAlign = Label.VerticalAlign.CENTER;
    };

    // Column letters (A, B, …) above the grid top.
    for (let c = c0; c < c0 + cols; c++) {
      addLabel(String.fromCharCode(65 + c), edgeX(c) + cell / 2, edgeY(r0) + LABEL_GAP * 0.6);
    }
    // Row numbers (1, 2, …) left of the grid.
    for (let r = r0; r < r0 + rows; r++) {
      addLabel(`${r + 1}`, edgeX(c0) - LABEL_GAP * 0.6, edgeY(r) - cell / 2);
    }
  }

  private rebuildPlacedLayer() {
    if (!this.placedLayer) return;
    // destroy (not just detach) — these rebuild on every placement change.
    this.placedLayer.destroyAllChildren();
    for (const p of gameStore.getState().placedPieces) {
      const node = new Node('piece');
      this.placedLayer.addChild(node);
      const comp = node.addComponent(PlacedPiece);
      comp.init(p);
    }
  }

  private redrawWalls() {
    if (!this.wallsLayer) return;
    const g = this.wallsLayer.getComponent(Graphics);
    if (!g) return;
    const s = gameStore.getState();
    // Red while the active room is still being walled and isn't sealed yet;
    // white once it's enclosed (or in any other phase).
    const sealing = getRoomPhase(s) === 'construction' && s.wallPhase === 'walls';
    const color = sealing && !isActiveRoomEnclosed(s)
      ? new Color(230, 80, 70, 235)
      : new Color(255, 255, 255, 235);
    drawWalls(g, s.walls, color, s.doors, s.lockedWalls);
  }
  private redrawDoors() {
    if (!this.doorsLayer) return;
    const g = this.doorsLayer.getComponent(Graphics);
    const s = gameStore.getState();
    if (g && s.scenario) drawDoors(g, s.doors, s.scenario, s.walls, s.placedPieces, s.frontDoorEdge);
  }

  /** Lazily create the blocked-room overlay layer, just below the placed
   *  pieces so a red wash tints the floor but not the furniture art. */
  private ensureBlockedLayer(): Graphics | null {
    if (!this.blockedLayer || !this.blockedLayer.isValid) {
      this.blockedLayer = new Node('BlockedLayer');
      this.node.addChild(this.blockedLayer);
      this.blockedLayer.addComponent(Graphics);
      if (this.placedLayer && this.placedLayer.isValid) {
        this.blockedLayer.setSiblingIndex(this.placedLayer.getSiblingIndex());
      }
    }
    return this.blockedLayer.getComponent(Graphics);
  }

  /** Red-wash every cell of any SEALED room that's now blocked — its door
   *  opens into another room (default "rooms must be independent" rule), or
   *  it's cut off from the front door. Mirrors the web's problem-room overlay. */
  private redrawBlocked() {
    const g = this.ensureBlockedLayer();
    if (!g) return;
    const s = gameStore.getState();
    if (!s.scenario) { g.clear(); return; }
    // Only SEALED rooms count as "rooms" for this analysis. A room still being
    // built has its furniture sitting in the not-yet-subdivided corridor; if we
    // counted it, a finished room whose door correctly opens into that corridor
    // would look like it opens "into" the in-progress room and be wrongly
    // flagged. Walls/doors of unsealed work stay in — only their room identity
    // is withheld until the room is sealed.
    const sealedPieces = s.placedPieces.filter((p) => s.completedRoomSlots.has(p.roomSlot));
    const access = analyseAccessibility(
      s.scenario, sealedPieces, s.walls, s.doors, s.frontDoorEdge,
    );
    const problem = new Set<RoomSlot>();
    for (const issue of access.doorIssues) {
      // doorIssues are now only about sealed rooms; ignore any that reference a
      // room with no sealed pieces (e.g. an in-progress room's stray door).
      if (s.completedRoomSlots.has(issue.roomSlot)) problem.add(issue.roomSlot);
    }
    // Once the front door exists, also flag sealed rooms unreachable from it.
    if (s.frontDoorEdge) {
      for (const room of s.scenario.rooms) {
        if (s.completedRoomSlots.has(room.slot) && !isRoomAccessible(access, room.slot)) {
          problem.add(room.slot);
        }
      }
    }
    const cells: string[] = [];
    for (const slot of problem) {
      // (problem only ever contains sealed rooms — both sources above filter
      // on completedRoomSlots.)
      const reg = access.roomToRegion.get(slot);
      if (reg === undefined) continue;
      for (const k of access.regionMap.cellsByRegion.get(reg) ?? []) cells.push(k);
    }
    drawCellWash(g, cells);
  }
  private redrawWindows() {
    if (!this.windowsLayer) return;
    const g = this.windowsLayer.getComponent(Graphics);
    const s = gameStore.getState();
    if (g && s.scenario) drawWindows(g, s.windows, s.scenario);
  }

  // ── Inaccessible open-space overlay ──────────────────────────────────────

  private ensureInaccessibleLayer(): Graphics | null {
    if (!this.inaccessibleLayer || !this.inaccessibleLayer.isValid) {
      this.inaccessibleLayer = new Node('InaccessibleOpenLayer');
      this.node.addChild(this.inaccessibleLayer);
      this.inaccessibleLayer.addComponent(Graphics);
      // render above placed pieces so dots are always visible
      if (this.placedLayer && this.placedLayer.isValid) {
        this.inaccessibleLayer.setSiblingIndex(this.placedLayer.getSiblingIndex() + 1);
      }
    }
    return this.inaccessibleLayer.getComponent(Graphics);
  }

  /** Red wash on every open-space cell that is walkable but unreachable
   *  from any door (pre-drawn + player + front door) via walkable floor.
   *  Skipped during the wall-drawing phase: open cells may be temporarily
   *  enclosed while drawing walls; the check resumes once doors are added. */
  private redrawInaccessibleOpen() {
    const g = this.ensureInaccessibleLayer();
    if (!g) return;
    const s = gameStore.getState();
    if (!s.scenario) { g.clear(); return; }
    // Suppress only while actively constructing a room (drawing walls, or
    // placing its door before any door exists). During furniture placement the
    // check must run. See shouldSuppressOpenCellCheck.
    if (shouldSuppressOpenCellCheck(s)) { g.clear(); return; }

    // ── 1. all open_spaces (placed pieces) ───────────────────────────────
    const allOpenSpaces = new Set<string>();
    for (const p of s.placedPieces) {
      for (const [r, c] of pieceOpenSpaceCells(p)) allOpenSpaces.add(`${r},${c}`);
    }
    if (allOpenSpaces.size === 0) { g.clear(); return; }

    // ── 2. walkable + reachable via shared core (no ghost) ───────────────
    const { walkable, reachable } = computeFloorReachability(
      s.scenario, s.placedPieces, s.walls, s.doors, s.frontDoorEdge,
    );

    // ── 3. inaccessible = open_spaces walkable but not reachable ─────────
    const inaccessible: string[] = [];
    for (const k of allOpenSpaces) {
      if (walkable.has(k) && !reachable.has(k)) inaccessible.push(k);
    }
    drawCellWash(g, inaccessible, new Color(255, 60, 60, 140));
  }
}
