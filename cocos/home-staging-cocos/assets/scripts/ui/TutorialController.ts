import { _decorator, Component, Node, Vec3, UITransform, director } from 'cc';
import { gameStore, pieceOpenCells, type GameState } from '../state/gameStore';
import { resolveOption } from '../core/pieces';
import { transformOption } from '../core/geometry';
import { edgeX, edgeY } from './viewport';
import { HandPointer } from './HandPointer';
import { TutorialOverlay } from './TutorialOverlay';
import { GhostPiece } from './GhostPiece';
import { InputHandler } from './InputHandler';
import type { TutorialStep, GateAction } from './tutorialTypes';
const { ccclass } = _decorator;

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
    }
    if (!ok && this.hand) this.hand.shake();
    return ok;
  }

  /** InputHandler 旋转成功后调用,供「旋转 ≥N 次」计数。 */
  notifyRotated() { this.rotateCount++; }

  update() {
    if (!this.active()) { this.node.active = false; return; }
    const step = this.cur()!;
    const target = this.resolveTarget(step);
    if (target) {
      const oui = this.overlay.node.getComponent(UITransform)!;
      const local = oui.convertToNodeSpaceAR(target);
      this.overlay.setHole(local, 90, 70);
      this.overlay.setBubble(step.text, local);

      if (this.startedIdx !== this.idx) {
        this.startedIdx = this.idx;
        if (step.hand === 'drag' && step.pointTo.kind === 'dragPath') {
          const from = this.resolveCard(step.pointTo.fromCard);
          if (from) this.hand.playDrag(from, target); else this.hand.playTap(target);
        } else if (step.hand === 'rotate') {
          this.hand.playRotate(target);
        } else {
          this.hand.playTap(target);
        }
      } else if (step.hand !== 'drag') {
        this.hand.pointAt(target);   // 目标动了就同步位置(脉冲继续)
      }
    }

    if (this.advanceMet(step)) {
      this.idx++;
      this.startedIdx = -1;
      this.rotateCount = 0;
      this.prevPlaced = gameStore.getState().placedPieces.length;
    }
  }

  private advanceMet(step: TutorialStep): boolean {
    const s = gameStore.getState();
    switch (step.advanceOn.on) {
      case 'ghostPositioned': return !!this.getGhost()?.isPositioned();
      case 'placed': {
        if (s.placedPieces.length <= this.prevPlaced) return false;
        if (step.advanceOn.sharesOpenCell) return this.lastPlaceShares(s);
        return true;
      }
      case 'rotatedAtLeast': return this.rotateCount >= step.advanceOn.times;
      case 'demolishModeOn':  return s.demolishMode === true;
      case 'removed':         return s.placedPieces.length < this.prevPlaced;
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

  // ── 坐标解析 ──
  private resolveTarget(step: TutorialStep): Vec3 | null {
    const pt = step.pointTo;
    if (pt.kind === 'card')     return this.resolveCard(pt.index);
    if (pt.kind === 'button')   return this.worldOf(pt.name);
    if (pt.kind === 'cell')     return this.resolveCell(pt.cell);
    if (pt.kind === 'dragPath') return this.resolveCell(pt.to);
    return null;
  }
  private resolveCard(idx: number): Vec3 | null { return this.worldOf(`card_${idx}`); }

  private resolveCell(cell: [number, number]): Vec3 | null {
    const fp = this.floorPlan;
    if (!fp || !fp.isValid) return null;
    const ui = fp.getComponent(UITransform);
    if (!ui) return null;
    const cx = (edgeX(cell[1]) + edgeX(cell[1] + 1)) / 2;
    const cy = (edgeY(cell[0]) + edgeY(cell[0] + 1)) / 2;
    return ui.convertToWorldSpaceAR(new Vec3(cx, cy, 0));
  }

  private worldOf(nodeName: string): Vec3 | null {
    const scene = director.getScene();
    if (!scene) return null;
    const n = this.findByName(scene, nodeName);
    if (!n) return null;
    const ui = n.getComponent(UITransform);
    return ui ? ui.convertToWorldSpaceAR(new Vec3(0, 0, 0)) : n.worldPosition.clone();
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
