import { _decorator, Component, Graphics, Node, UITransform, view, Label, Color } from 'cc';
import { gameStore, getRoomPhase, isActiveRoomEnclosed } from '../state/gameStore';
import { drawGridBg, drawWalls, drawDoors, drawWindows, drawPreDrawn } from './LayerRenderer';
import { computeLayout, setLayout, layout, edgeX, edgeY, LABEL_GAP } from './viewport';
import { PlacedPiece } from './PlacedPiece';
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

  start() {
    this.renderAll();
    this.unsub = gameStore.subscribe((s, prev) => {
      if (s.scenario !== prev.scenario) this.renderAll();
      if (s.placedPieces !== prev.placedPieces) { this.rebuildPlacedLayer(); this.redrawWalls(); this.redrawDoors(); }
      if (s.walls !== prev.walls) { this.redrawWalls(); this.redrawDoors(); }
      if (s.doors !== prev.doors) { this.redrawDoors(); this.redrawWalls(); }
      if (s.windows !== prev.windows) this.redrawWindows();
      // Wall colour depends on enclosure + phase + active room.
      if (s.wallPhase !== prev.wallPhase || s.activeRoomSlot !== prev.activeRoomSlot) {
        this.redrawWalls();
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
    const g = this.gridBg?.getComponent(Graphics);
    if (g) drawGridBg(g, s.scenario);
    const pg = this.preDrawnLayer?.getComponent(Graphics);
    if (pg) drawPreDrawn(pg, s.scenario);
    this.buildLabels();
    this.rebuildPlacedLayer();
    this.redrawWalls();
    this.redrawDoors();
    this.redrawWindows();
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
    drawWalls(g, s.walls, color, s.doors);
  }
  private redrawDoors() {
    if (!this.doorsLayer) return;
    const g = this.doorsLayer.getComponent(Graphics);
    const s = gameStore.getState();
    if (g && s.scenario) drawDoors(g, s.doors, s.scenario, s.walls, s.placedPieces);
  }
  private redrawWindows() {
    if (!this.windowsLayer) return;
    const g = this.windowsLayer.getComponent(Graphics);
    const s = gameStore.getState();
    if (g && s.scenario) drawWindows(g, s.windows, s.scenario);
  }
}
