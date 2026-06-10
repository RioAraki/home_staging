import { _decorator, Component, Graphics, Node, UITransform, view, Label, Color } from 'cc';
import { gameStore, getRoomPhase, isActiveRoomEnclosed } from '../state/gameStore';
import { drawGridBg, drawWalls, drawDoors, drawWindows, drawPreDrawn, drawCellWash } from './LayerRenderer';
import { analyseAccessibility, isRoomAccessible } from '../core/regions';
import type { RoomSlot } from '../core/types';
import { computeLayout, setLayout, layout, edgeX, edgeY, LABEL_GAP } from './viewport';
import { PlacedPiece } from './PlacedPiece';
import { CARPET_NUMBER, pieceShapeCells, pieceOpenSpaceCells } from '../core/pieces';
import { doorEdgeKey } from '../core/walls';
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
      // its symbol in the doors layer — redraw both when it changes.
      if (s.frontDoorEdge !== prev.frontDoorEdge) { this.redrawGrid(); this.redrawDoors(); }
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
    this.labelsNode.removeAllChildren();

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
    this.placedLayer.removeAllChildren();
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
      // Only flag rooms the player has finished — a room still being built is
      // expected to be "open" and shouldn't flash red mid-placement.
      if (!s.completedRoomSlots.has(slot)) continue;
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
    // Suppress during wall-drawing phase — doors haven't been placed yet.
    if (s.wallPhase === 'walls') { g.clear(); return; }
    // Also suppress during door-placement phase until the player has placed
    // at least one door for the active room. Before any door exists the
    // enclosed open cells are expected; only flag them once a door is open.
    if (s.wallPhase === 'door' && s.activeRoomSlot &&
        !Object.values(s.doors as Record<string, string>).includes(s.activeRoomSlot)) {
      g.clear(); return;
    }

    // ── 1. build blocked (non-carpet shape) and all open_spaces ──────────
    const allBlocked = new Set<string>();
    const allOpenSpaces = new Set<string>();
    for (const p of s.placedPieces) {
      if (p.number !== CARPET_NUMBER) {
        for (const [r, c] of pieceShapeCells(p)) allBlocked.add(`${r},${c}`);
      }
      for (const [r, c] of pieceOpenSpaceCells(p)) allOpenSpaces.add(`${r},${c}`);
    }
    if (allOpenSpaces.size === 0) { g.clear(); return; }

    // ── 2. walkable = indoor cells not blocked ────────────────────────────
    const walkable = new Set<string>();
    const ascii = s.scenario.grid.ascii.replace(/\n+$/, '').split('\n');
    const legend = s.scenario.grid.legend;
    for (let r = 0; r < ascii.length; r++) {
      for (let c = 0; c < (ascii[r]?.length ?? 0); c++) {
        const ch = ascii[r][c];
        if (ch && legend[ch]?.terrain === 'indoor') {
          const k = `${r},${c}`;
          if (!allBlocked.has(k)) walkable.add(k);
        }
      }
    }

    // ── 3. BFS seeds: cells adjacent to any door ─────────────────────────
    const seeds = new Set<string>();
    const adjFromEdge = (ek: string) => {
      const [type, rs, cs] = ek.split(':');
      const r = parseInt(rs, 10), c = parseInt(cs, 10);
      const pairs: [number,number][] = type === 'h' ? [[r-1,c],[r,c]] : [[r,c-1],[r,c]];
      for (const [pr, pc] of pairs) {
        const k = `${pr},${pc}`;
        if (walkable.has(k)) seeds.add(k);
      }
    };
    for (const ek of Object.keys(s.doors)) adjFromEdge(ek);
    if (s.frontDoorEdge) adjFromEdge(s.frontDoorEdge);
    for (const d of (s.scenario.pre_drawn?.doors ?? [])) {
      if (d.edge) adjFromEdge(doorEdgeKey(d.cell, d.edge));
    }
    // fallback: if still no seeds, use ONE arbitrary walkable indoor cell
    // that isn't itself an open_space (bare floor) as the anchor.
    // Avoid outdoor-adjacent cells as fallback: those could be enclosed
    // pockets that share an outdoor edge but are cut off from the rest.
    if (seeds.size === 0) {
      for (const k of walkable) {
        if (!allOpenSpaces.has(k)) { seeds.add(k); break; }
      }
    }

    // ── 4. BFS through walkable, respecting player walls ─────────────────
    // Walls block traversal between adjacent cells. Doors are openings
    // (their edge has NO wall entry), so BFS passes through them naturally.
    const isWalled = (r: number, c: number, nr: number, nc: number): boolean => {
      let edgeKey: string;
      if      (nr === r - 1) edgeKey = `h:${r}:${c}`;
      else if (nr === r + 1) edgeKey = `h:${r + 1}:${c}`;
      else if (nc === c - 1) edgeKey = `v:${r}:${c}`;
      else                   edgeKey = `v:${r}:${c + 1}`;
      return !!s.walls[edgeKey];
    };

    const reachable = new Set<string>(seeds);
    const queue = [...seeds];
    while (queue.length) {
      const curr = queue.shift()!;
      const [r, c] = curr.split(',').map(Number);
      for (const [nr, nc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]) {
        const nk = `${nr},${nc}`;
        if (walkable.has(nk) && !reachable.has(nk) && !isWalled(r, c, nr, nc)) {
          reachable.add(nk);
          queue.push(nk);
        }
      }
    }

    // ── 5. inaccessible = open_spaces walkable but not reachable ─────────
    const inaccessible: string[] = [];
    for (const k of allOpenSpaces) {
      if (walkable.has(k) && !reachable.has(k)) inaccessible.push(k);
    }
    drawCellWash(g, inaccessible, new Color(255, 60, 60, 140));
  }
}
