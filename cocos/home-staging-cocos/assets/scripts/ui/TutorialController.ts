import { _decorator, Component, Node, Vec3, UITransform, director } from 'cc';
import { gameStore, pieceOpenCells, type GameState } from '../state/gameStore';
import { resolveOption } from '../core/pieces';
import { transformOption } from '../core/geometry';
import { roomItemAt } from '../core/roomItems';
import { furnitureByName, cardByNumberVariant } from '../core/dataLoader';
import { edgeX, edgeY, layout } from './viewport';
import { HandPointer } from './HandPointer';
import { TutorialOverlay } from './TutorialOverlay';
import { GhostPiece } from './GhostPiece';
import { InputHandler } from './InputHandler';
import type { TutorialStep, GateAction } from './tutorialTypes';
const { ccclass } = _decorator;

/** 一个高亮洞:overlay 本地坐标的中心 {x,y} + 半尺寸 {hw,hh}。 */
interface Hole { x: number; y: number; hw: number; hh: number }

/**
 * 强引导教程状态机。
 *  • gate(action)  —— 被 InputHandler / RoomPanel 在动作执行「前」调用,只放行当前步要求的动作。
 *  • update()      —— 每帧重新解析当前步目标的世界坐标,定位示意手 + 挖洞 + 气泡,并判断是否完成→推进。
 * 每帧重定位天然规避「拆除触发 RoomPanel 全量 rebuild 使按钮节点重建」的时序坑。
 */
@ccclass('TutorialController')
export class TutorialController extends Component {
  static instance: TutorialController | null = null;

  private steps: TutorialStep[] = [];
  private idx = 0;
  private startedIdx = -1;       // 已为哪一步启动过手势动画(避免每帧重启 tween)
  private rotateCount = 0;
  private prevPlaced = 0;
  private dragged = false;       // 拖拽步:玩家是否已松手(只在松手后才进下一步)
  private confirmed = false;     // 讲解步:玩家是否点了「我知道了」

  private hand!: HandPointer;
  private overlay!: TutorialOverlay;
  private floorPlan: Node | null = null;
  private ghost: GhostPiece | null = null;

  // ── 自启动(GameBootstrap 调用)──
  private started = false;
  private lastScenario: unknown = null;

  /** 常驻挂载后调用:监听 scenario,进入带 tutorial 的关卡且选了房间时自动开始。 */
  autoStart(overlay: TutorialOverlay, hand: HandPointer) {
    this.overlay = overlay; this.hand = hand;
    this.node.active = false;
    gameStore.subscribe((s) => {
      if (s.scenario !== this.lastScenario) {     // 换关 → 允许重新演示(Q3:每次都演示)
        this.lastScenario = s.scenario;
        this.started = false;
        this.node.active = false;
        TutorialController.instance = null;
      }
      const tut = (s.scenario as any)?.tutorial;
      if (!this.started && tut?.steps?.length && s.activeRoomSlot) {
        this.floorPlan =
          director.getScene()?.getComponentInChildren(InputHandler)?.floorPlan ?? null;
        this.started = true;
        this.node.active = true;
        this.begin(tut.steps as TutorialStep[]);
      }
    });
  }

  private begin(steps: TutorialStep[]) {
    this.steps = steps;
    this.idx = 0;
    this.startedIdx = -1;
    this.rotateCount = 0;
    this.prevPlaced = gameStore.getState().placedPieces.length;
    TutorialController.instance = this;
  }

  onDestroy() { if (TutorialController.instance === this) TutorialController.instance = null; }

  private cur(): TutorialStep | null { return this.steps[this.idx] ?? null; }
  private active(): boolean { return this.idx < this.steps.length; }

  // ── 强锁步门控 ──
  gate(a: GateAction): boolean {
    if (!this.active()) return true;            // 教程结束 → 全部放行
    const g = this.cur()!.gate;
    let ok = false;
    switch (g.action) {
      case 'drag':
        ok = a.kind === 'select' && a.slotIdx === g.cardIndex; break;
      case 'rotate':
        ok = a.kind === 'rotate' || a.kind === 'select'; break;   // 旋转步:允许选中/点旋转
      case 'place':
        if (a.kind === 'select') {
          ok = g.cardIndex !== undefined && a.slotIdx === g.cardIndex;  // 丢失选中后可重新拿卡
        } else if (a.kind === 'place') {
          const cellOk = !g.cell || (a.origin[0] === g.cell[0] && a.origin[1] === g.cell[1]);
          const shareOk = !g.requireShare || this.wouldShare(a.origin);
          ok = cellOk && shareOk;
        }
        break;
      case 'demolishToggle':
        ok = a.kind === 'demolishToggle'; break;
      case 'demolishCell':
        ok = a.kind === 'demolishCell'
          && (!g.cell || (a.cell[0] === g.cell[0] && a.cell[1] === g.cell[1])); break;
      case 'none':
        ok = false; break;   // 讲解步:任何游戏操作都不放行
    }
    if (!ok && this.hand) this.hand.shake();
    return ok;
  }

  /** InputHandler 旋转成功后调用,供「旋转 ≥N 次」计数。 */
  notifyRotated() { this.rotateCount++; }

  /** RoomPanel/InputHandler 在一次拖拽松手(ghost 落定)后调用——拖拽步只在此后才推进。 */
  notifyDragDropped() { this.dragged = true; }

  update() {
    if (!this.active()) { this.node.active = false; this.overlay.hideConfirm(); return; }
    const step = this.cur()!;
    const vis = this.stepVisual(step);
    if (vis) {
      this.overlay.setHoles(vis.holes);
      this.overlay.setBubble(step.text, vis.bubbleAt);

      if (this.startedIdx !== this.idx) {
        this.startedIdx = this.idx;
        // 讲解步:显示「我知道了」按钮;其余步隐藏。
        if (step.advanceOn.on === 'confirm') {
          this.overlay.showConfirm(() => { this.confirmed = true; });
          this.hand.setPos(vis.handTo);
        } else {
          this.overlay.hideConfirm();
          if (step.hand === 'drag' && vis.handFrom) this.hand.playDrag(vis.handFrom, vis.handTo);
          else this.hand.playTap(vis.handTo);   // tap / rotate / drag-without-source
        }
      } else if (step.hand !== 'drag') {
        this.hand.setPos(vis.handTo);       // 目标动了就同步位置(脉冲继续)
      }
    }

    if (this.advanceMet(step)) {
      this.idx++;
      this.startedIdx = -1;
      this.rotateCount = 0;
      this.dragged = false;
      this.confirmed = false;
      this.overlay.hideConfirm();
      this.prevPlaced = gameStore.getState().placedPieces.length;
    }
  }

  private advanceMet(step: TutorialStep): boolean {
    const s = gameStore.getState();
    switch (step.advanceOn.on) {
      // 只有松手后(dragged)且 ghost 落定才算「拖拽完成」——拖到一半不推进。
      case 'ghostPositioned': return this.dragged && !!this.getGhost()?.isPositioned();
      case 'placed': {
        if (s.placedPieces.length <= this.prevPlaced) return false;
        if (step.advanceOn.sharesOpenCell) return this.lastPlaceShares(s);
        return true;
      }
      case 'rotatedAtLeast': return this.rotateCount >= step.advanceOn.times;
      case 'demolishModeOn':  return s.demolishMode === true;
      case 'demolishModeOff': return s.demolishMode === false;
      case 'removed':         return s.placedPieces.length < this.prevPlaced;
      case 'confirm':         return this.confirmed;
    }
    return false;
  }

  /** 当前选中的家具若放在 origin,是否会与某件已放家具共用开放格。
   *  用于 requireShare 步:拦截不共享的落点(因此从未真正落子,卡仍留在托盘,可恢复)。 */
  private wouldShare(origin: [number, number]): boolean {
    const s = gameStore.getState();
    const sel = s.selectedOption;
    if (!sel) return false;
    const opt = resolveOption(sel);
    if (!opt) return false;
    const t = transformOption(opt, sel.rotation, sel.mirrored);
    const cand = new Set<string>();
    for (const [r, c] of t.open_spaces) cand.add(`${origin[0] + r},${origin[1] + c}`);
    for (const p of s.placedPieces) {
      const other = pieceOpenCells(p);
      for (const k of cand) if (other.has(k)) return true;
    }
    return false;
  }

  /** 最后放下的家具是否与之前任一家具共享开放格。 */
  private lastPlaceShares(s: GameState): boolean {
    const pp = s.placedPieces;
    if (pp.length < 2) return false;
    const last = pieceOpenCells(pp[pp.length - 1]);
    for (let i = 0; i < pp.length - 1; i++) {
      const other = pieceOpenCells(pp[i]);
      for (const k of last) if (other.has(k)) return true;
    }
    return false;
  }

  // ── 视觉解析(全部 overlay 本地坐标)──
  /** 当前步要挖的洞 + 示意手起讫点。 */
  private stepVisual(step: TutorialStep):
    { holes: Hole[]; bubbleAt: Vec3; handTo: Vec3; handFrom?: Vec3 } | null {
    const pt = step.pointTo;
    let holes: Hole[] = [];
    let handTo: Vec3 | null = null;
    let handFrom: Vec3 | undefined;

    if (pt.kind === 'dragPath') {
      // 目标格洞按被拖家具真实尺寸(单人床 2×2 → 4 格);to = footprint 左上角原点。
      const bbox = this.cardBBox(pt.fromCard);
      const cellH = this.footprintHoleAt(pt.to[0], pt.to[1], bbox[0], bbox[1]);
      if (!cellH) return null;
      const cardH = this.nodeHole(`card_${pt.fromCard}`);   // 被拖的卡片也高亮
      holes = cardH ? [cellH, cardH] : [cellH];
      handTo = new Vec3(cellH.x, cellH.y, 0);
      handFrom = cardH ? new Vec3(cardH.x, cardH.y, 0) : undefined;
    } else if (pt.kind === 'cell') {
      const h = this.footprintHoleAt(pt.cell[0], pt.cell[1], 1, 1);
      if (!h) return null;
      holes = [h]; handTo = new Vec3(h.x, h.y, 0);
    } else if (pt.kind === 'ghost') {
      const h = this.ghostHole();
      if (!h) return null;
      holes = [h]; handTo = new Vec3(h.x, h.y, 0);
    } else if (pt.kind === 'lastPlaced') {
      const h = this.lastPlacedHole();
      if (!h) return null;
      holes = [h]; handTo = new Vec3(h.x, h.y, 0);
    } else if (pt.kind === 'goal') {
      // 旋转步:高亮「希望玩家旋转到」的终点 footprint;手指向当前 ghost(点它旋转)。
      const gh = this.goalHole(pt.cardIndex, pt.rotation, pt.origin);
      if (!gh) return null;
      holes = [gh];
      const gz = this.ghostHole();
      handTo = gz ? new Vec3(gz.x, gz.y, 0) : new Vec3(gh.x, gh.y, 0);
    } else if (pt.kind === 'openCells') {
      // 讲解步:高亮所有已放家具的开放格。
      holes = this.openCellHoles();
      if (holes.length === 0) return null;
      handTo = new Vec3(holes[0].x, holes[0].y, 0);
    } else {
      // 卡片 / 按钮:洞 = 节点包围盒。
      const name = pt.kind === 'card' ? `card_${pt.index}` : pt.name;
      const h = this.nodeHole(name);
      if (!h) return null;
      holes = [h]; handTo = new Vec3(h.x, h.y, 0);
    }

    // 放置步:家具尚未真正落子,连同当前 ghost 一起高亮。
    if (step.gate.action === 'place') {
      const gz = this.ghostHole();
      if (gz) holes = [...holes, gz];
    }

    if (!handTo) return null;
    return { holes, bubbleAt: handTo, handTo, handFrom };
  }

  /** 第 cardIndex 件家具转到 rotation、放在 origin 时的 footprint 洞(旋转终点)。 */
  private goalHole(cardIndex: number, rotation: number, origin: [number, number]): Hole | null {
    const opt = this.cardOption(cardIndex);
    if (!opt) return null;
    const t = transformOption(opt, rotation as any, false);
    return this.footprintHoleAt(origin[0], origin[1], t.bbox[0], t.bbox[1]);
  }

  /** 所有已放家具的开放格,各一个 1×1 洞。 */
  private openCellHoles(): Hole[] {
    const out: Hole[] = [];
    for (const p of gameStore.getState().placedPieces) {
      for (const k of pieceOpenCells(p)) {
        const [r, c] = k.split(',').map(Number);
        const h = this.footprintHoleAt(r, c, 1, 1);
        if (h) out.push(h);
      }
    }
    return out;
  }

  private toOverlay(world: Vec3): Vec3 {
    return this.overlay.node.getComponent(UITransform)!.convertToNodeSpaceAR(world);
  }

  /** 网格对齐洞:左上角原点 (oR,oC),大小 rows×cols 格。 */
  private footprintHoleAt(oR: number, oC: number, rows: number, cols: number): Hole | null {
    const fp = this.floorPlan;
    if (!fp || !fp.isValid) return null;
    const ui = fp.getComponent(UITransform);
    if (!ui) return null;
    const cx = (edgeX(oC) + edgeX(oC + cols)) / 2;
    const cy = (edgeY(oR) + edgeY(oR + rows)) / 2;
    const local = this.toOverlay(ui.convertToWorldSpaceAR(new Vec3(cx, cy, 0)));
    const px = layout().cell;
    return { x: local.x, y: local.y, hw: (cols * px) / 2, hh: (rows * px) / 2 };
  }

  /** 当前 ghost(选中家具)所在 footprint 的洞。 */
  private ghostHole(): Hole | null {
    const g = this.getGhost();
    const sel = gameStore.getState().selectedOption;
    if (!g || !g.isPositioned() || !sel) return null;
    const opt = resolveOption(sel);
    if (!opt) return null;
    const t = transformOption(opt, sel.rotation, sel.mirrored);
    const [oR, oC] = g.getOrigin();
    return this.footprintHoleAt(oR, oC, t.bbox[0], t.bbox[1]);
  }

  /** 最近放下的家具 footprint 的洞。 */
  private lastPlacedHole(): Hole | null {
    const pp = gameStore.getState().placedPieces;
    const p = pp[pp.length - 1];
    if (!p) return null;
    const opt = resolveOption(p);
    if (!opt) return null;
    const t = transformOption(opt, p.rotation, p.mirrored);
    return this.footprintHoleAt(p.origin[0], p.origin[1], t.bbox[0], t.bbox[1]);
  }

  /** 节点(卡片/按钮)的包围盒洞。按钮进拆除模式后名字带 ✓,故名字找不到时再试 "<name> ✓"。 */
  private nodeHole(name: string): Hole | null {
    const scene = director.getScene();
    if (!scene) return null;
    const n = this.findByName(scene, name) ?? this.findByName(scene, `${name} ✓`);
    if (!n) return null;
    const ui = n.getComponent(UITransform);
    const world = ui ? ui.convertToWorldSpaceAR(new Vec3(0, 0, 0)) : n.worldPosition.clone();
    const sx = Math.abs(n.worldScale.x), sy = Math.abs(n.worldScale.y);
    const local = this.toOverlay(world);
    const hw = ui ? (ui.contentSize.width * sx) / 2 + 8 : 60;
    const hh = ui ? (ui.contentSize.height * sy) / 2 + 8 : 40;
    return { x: local.x, y: local.y, hw, hh };
  }

  /** 房间第 cardIndex 件家具的未旋转 bbox(行,列);解析不到则 1×1。 */
  /** 房间第 cardIndex 件家具的未旋转 option(含 bbox/shape/open_spaces)。 */
  private cardOption(cardIndex: number) {
    const s = gameStore.getState();
    const room = s.scenario?.rooms.find(r => r.slot === s.activeRoomSlot);
    if (!room) return null;
    const item = roomItemAt(room, cardIndex);
    if (!item) return null;
    if (item.kind === 'named') {
      const e = furnitureByName(item.name);
      return e ? resolveOption({
        number: e.number ?? 0, variant: e.variant ?? 'A', optionIndex: e.option_index ?? 1,
        rotation: 0, mirrored: false, name: item.name,
      } as any) : null;
    }
    const variant = s.chosenVariants[item.number] ?? 'A';
    const o = cardByNumberVariant(item.number, variant)?.options?.[0];
    return o ? resolveOption({
      number: item.number, variant, optionIndex: o.option_index, rotation: 0, mirrored: false,
    } as any) : null;
  }

  /** 第 cardIndex 件家具的未旋转 bbox(行,列);解析不到则 1×1。 */
  private cardBBox(cardIndex: number): [number, number] {
    const opt = this.cardOption(cardIndex);
    return opt ? (opt.bbox as [number, number]) : [1, 1];
  }
  private findByName(root: Node, name: string): Node | null {
    if (root.name === name && root.activeInHierarchy) return root;
    for (const c of root.children) { const r = this.findByName(c, name); if (r) return r; }
    return null;
  }

  private getGhost(): GhostPiece | null {
    if (this.ghost?.isValid) return this.ghost;
    this.ghost = director.getScene()?.getComponentInChildren(GhostPiece) ?? null;
    return this.ghost;
  }
}
