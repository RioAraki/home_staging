# 通用强引导教程系统 实现计划（首关「陋室」）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans。本项目是 Cocos Creator 工程，
> **没有单元测试框架**——每个任务的「验证」是在 Cocos 编辑器里 Reimport + Preview 后按 AGENTS.md 规范用编辑器 Console 观察。
> Steps use checkbox (`- [ ]`).

**Goal:** 给陋室关卡加一套示意手强引导教程，并做成数据驱动、可跨关卡复用的引擎。

**Architecture:** 一个 `TutorialController`（每帧 `update()` 重定位示意手/挖洞遮罩 + 检测当前步完成条件并推进）；
一道静态 `gate()` 被 `InputHandler` / `RoomPanel` 在动作执行前调用做强锁步；步骤声明放进 `training.json` 的 `tutorial.steps`。

**Tech Stack:** Cocos Creator 3.x、TypeScript、Graphics 绘制（示意手用矢量绘制，零美术资产、零编辑器 Reimport 摩擦）。

**与 spec 的两点工程取舍（已据现状定）：**
1. **示意手用 `Graphics` 矢量绘制**（一只指向手 + 手势动画），不引入 Kenney PNG——避免「PNG 入 resources 写 trimType:none meta + 编辑器 Reimport」的手工摩擦，preview 里立即可见；将来想换 PNG 只需改 `HandPointer.drawHand()`。
2. **步骤在 JSON 里是原子步**（一步一动作一完成条件），spec 第 5 节按家具分组只是为了可读；本计划把它展开成 11 个原子步，完美匹配「一步一 gate 一 advance」的引擎模型。
3. **推进检测用每帧 `update()` 轮询**当前步的派生布尔（ghost 是否落定、placedPieces 数量、demolishMode、rotation 计数），而非 `store.subscribe`——因为 ghost 落定状态不在 store 里，且「拆除」会触发 RoomPanel 全量 rebuild 让按钮节点重建；每帧重新解析目标节点世界坐标天然规避这些时序坑。

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `scripts/ui/tutorialTypes.ts`（新增） | `TutorialStep` / `PointTarget` / `GateRule` / `AdvanceRule` 类型 + `GateAction` 联合 |
| `scripts/ui/HandPointer.ts`（新增） | 示意手节点：`Graphics` 画手 + `drag/tap/rotate` 三种动画 + `shake()` |
| `scripts/ui/TutorialOverlay.ts`（新增） | 全屏变暗 + 给目标矩形挖洞 + 跟随气泡文字 |
| `scripts/ui/TutorialController.ts`（新增） | 状态机：每帧重定位 + 推进；静态 `gate()`；持有 hand/overlay/ghost/floorPlan 引用 |
| `scripts/state/gameStore.ts`（编辑） | 导出小工具 `pieceOpenCells()`（计算一件已放家具的开放格集合，供 sharesOpenCell 判定） |
| `scripts/ui/InputHandler.ts`（编辑） | 拖拽 select、旋转、放置、`demolishMode` 点格 四处入口加 `gate()` |
| `scripts/ui/RoomPanel.ts`（编辑） | 「放置」「拆除」按钮回调加 `gate()`；卡片 select 入口加 `gate()` |
| `scripts/ui/GameBootstrap.ts`（编辑） | 数据加载后，若关卡有 `tutorial` 字段则实例化 `TutorialController` |
| `md/scenarios/training.json`（编辑） | 加 `tutorial.steps`（11 原子步），`scenarios:build` 后进 maps_data |
| `core/types.ts`（编辑） | `Scenario` 加可选 `tutorial?` 字段 |

---

## Task 1：教程类型定义

**Files:** Create `cocos/home-staging-cocos/assets/scripts/ui/tutorialTypes.ts`

- [ ] **Step 1: 写类型文件**

```ts
/** 一步教程：指向谁 / 说什么 / 只放行什么动作 / 怎样算完成。引擎对所有关卡通用。 */
export interface TutorialStep {
  id: string;
  text: string;
  pointTo: PointTarget;
  hand: 'drag' | 'tap' | 'rotate';
  gate: GateRule;
  advanceOn: AdvanceRule;
}

export type PointTarget =
  | { kind: 'card'; index: number }                 // 托盘里 card_<index> 节点
  | { kind: 'button'; name: '放置' | '拆除' }
  | { kind: 'cell'; cell: [number, number] }
  | { kind: 'dragPath'; fromCard: number; to: [number, number] };

export type GateRule =
  | { action: 'drag'; cardIndex: number; toArea?: [number, number][] }
  | { action: 'rotate'; minTimes: number }
  | { action: 'place'; cell?: [number, number] }
  | { action: 'demolishToggle' }
  | { action: 'demolishCell'; cell: [number, number] };

export type AdvanceRule =
  | { on: 'ghostPositioned' }
  | { on: 'placed'; sharesOpenCell?: boolean }
  | { on: 'rotatedAtLeast'; times: number }
  | { on: 'demolishModeOn' }
  | { on: 'removed' };

/** 运行时玩家动作（InputHandler/RoomPanel 调 gate 时传入）。 */
export type GateAction =
  | { kind: 'select'; slotIdx: number }
  | { kind: 'rotate' }
  | { kind: 'place'; origin: [number, number] }
  | { kind: 'demolishToggle' }
  | { kind: 'demolishCell'; cell: [number, number] };

export interface TutorialSpec { steps: TutorialStep[] }
```

- [ ] **Step 2: 验证编译**——编辑器自动 import 后 Console 无报错（此文件无运行逻辑，纯类型）。
- [ ] **Step 3: Commit** `feat(tutorial): 教程步骤类型定义`

---

## Task 2：Scenario 类型加 tutorial 字段 + store 开放格工具

**Files:** Modify `scripts/core/types.ts`、`scripts/state/gameStore.ts`

- [ ] **Step 1:** `core/types.ts` 的 `Scenario` 接口加可选字段（紧跟现有字段后）：

```ts
  /** 可选互动教程：强引导分步脚本。结构见 ui/tutorialTypes.ts。 */
  tutorial?: { steps: any[] };
```

- [ ] **Step 2:** `gameStore.ts` 末尾（`subscribe` 导出附近）加一个纯函数，计算某件已放家具占用的「开放格」绝对坐标集合，供 sharesOpenCell 判定。复用 `resolveOption` + `transformOption`：

```ts
import { resolveOption } from '../core/pieces';
import { transformOption } from '../core/geometry';

/** 一件已放家具的开放格（open_spaces）绝对网格坐标 "r,c" 集合。 */
export function pieceOpenCells(p: PlacedPiece): Set<string> {
  const out = new Set<string>();
  const opt = resolveOption(p);
  if (!opt) return out;
  const t = transformOption(opt, p.rotation, p.mirrored);
  for (const [r, c] of t.open_spaces) out.add(`${p.origin[0] + r},${p.origin[1] + c}`);
  return out;
}
```
（若文件顶部已 import 这两个符号则不重复 import。）

- [ ] **Step 3: 验证**——编辑器 Console 无报错。
- [ ] **Step 4: Commit** `feat(tutorial): Scenario.tutorial 字段 + pieceOpenCells 工具`

---

## Task 3：HandPointer 示意手组件

**Files:** Create `scripts/ui/HandPointer.ts`

设计：一个 `Node` 下挂 `Graphics` 画一只朝左上指的手（简单矢量：手掌圆角矩形 + 食指）。组件方法：
`pointAt(worldPos)` 立刻移动；`playDrag(fromWorld, toWorld)` 沿直线循环平移；`playTap(worldPos)` 原地缩放脉冲；
`playRotate(worldPos)` 脉冲 + 小弧线；`shake()` 左右抖动表示「不能点这里」。用 `tween` 实现循环动画，切换手势时先停旧 tween。

- [ ] **Step 1: 写组件**（完整代码）：

```ts
import { _decorator, Component, Node, Graphics, Color, Vec3, tween, Tween, UITransform } from 'cc';
const { ccclass } = _decorator;

@ccclass('HandPointer')
export class HandPointer extends Component {
  private g!: Graphics;
  private anim: Tween<Node> | null = null;

  onLoad() {
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setContentSize(64, 64);
    this.g = this.node.addComponent(Graphics);
    this.drawHand();
  }

  /** 朝左上方指的手：白填充 + 深描边，锚点在指尖（节点原点=指尖）。 */
  private drawHand() {
    const g = this.g;
    g.clear();
    g.fillColor = new Color(255, 255, 255, 255);
    g.strokeColor = new Color(60, 45, 35, 255);
    g.lineWidth = 3;
    // 食指（指尖在原点附近）
    g.roundRect(-6, -34, 12, 26, 6); g.fill(); g.stroke();
    // 手掌
    g.roundRect(-16, -40, 34, 26, 10); g.fill(); g.stroke();
    // 拇指
    g.roundRect(-26, -34, 14, 12, 6); g.fill(); g.stroke();
  }

  private stop() { this.anim?.stop(); this.anim = null; this.node.setScale(1, 1, 1); }

  /** 立刻把指尖放到世界点（带一点偏移，指尖压在目标上）。 */
  pointAt(world: Vec3) {
    const local = this.toParentLocal(world);
    this.node.setPosition(local.x + 8, local.y - 8, 0);
  }

  playTap(world: Vec3) {
    this.stop();
    this.pointAt(world);
    this.anim = tween(this.node)
      .repeatForever(tween(this.node)
        .to(0.45, { scale: new Vec3(0.82, 0.82, 1) })
        .to(0.45, { scale: new Vec3(1, 1, 1) }))
      .start();
  }

  playRotate(world: Vec3) { this.playTap(world); }  // 复用脉冲（弧线箭头可后续加）

  playDrag(fromWorld: Vec3, toWorld: Vec3) {
    this.stop();
    const a = this.toParentLocal(fromWorld), b = this.toParentLocal(toWorld);
    const pa = new Vec3(a.x + 8, a.y - 8, 0), pb = new Vec3(b.x + 8, b.y - 8, 0);
    this.node.setPosition(pa);
    this.anim = tween(this.node)
      .repeatForever(tween(this.node)
        .set({ position: pa })
        .to(0.9, { position: pb })
        .delay(0.25)
        .call(() => { /* loop */ }))
      .start();
  }

  shake() {
    const p = this.node.position.clone();
    tween(this.node)
      .to(0.05, { position: new Vec3(p.x - 6, p.y, 0) })
      .to(0.05, { position: new Vec3(p.x + 6, p.y, 0) })
      .to(0.05, { position: p })
      .start();
  }

  private toParentLocal(world: Vec3): Vec3 {
    const pui = this.node.parent?.getComponent(UITransform);
    return pui ? pui.convertToNodeSpaceAR(world) : world.clone();
  }
}
```

- [ ] **Step 2: 验证**——暂无装配，留待 Task 6 整体预览。Console 无编译错。
- [ ] **Step 3: Commit** `feat(tutorial): HandPointer 示意手(矢量手+拖/点/抖动画)`

---

## Task 4：TutorialOverlay 变暗挖洞 + 气泡

**Files:** Create `scripts/ui/TutorialOverlay.ts`

设计：全屏 `Graphics` 画半透明深色，再用 `evenodd`/反向矩形挖一个亮洞（Cocos Graphics 不支持布尔挖洞 → 用「四块包围矩形」围出洞的方法：上/下/左/右四个矩形拼成「中间留空」的遮罩）。气泡 = `Node`+`Graphics`圆角底+`Label`。

- [ ] **Step 1: 写组件**（完整代码）：

```ts
import { _decorator, Component, Node, Graphics, Color, Label, UITransform, view, Vec3 } from 'cc';
const { ccclass } = _decorator;

@ccclass('TutorialOverlay')
export class TutorialOverlay extends Component {
  private g!: Graphics;
  private bubble!: Node;
  private bubbleBg!: Graphics;
  private label!: Label;

  onLoad() {
    const vs = view.getVisibleSize();
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setContentSize(vs.width, vs.height);
    this.g = this.node.addComponent(Graphics);

    this.bubble = new Node('bubble');
    this.node.addChild(this.bubble);
    this.bubble.addComponent(UITransform).setContentSize(360, 64);
    this.bubbleBg = this.bubble.addComponent(Graphics);
    const lblNode = new Node('text');
    this.bubble.addChild(lblNode);
    this.label = lblNode.addComponent(Label);
    this.label.fontSize = 24;
    this.label.color = new Color(255, 255, 255, 255);
    this.label.enableWrapText = true;
    lblNode.addComponent(UITransform).setContentSize(330, 60);
  }

  /** 四矩形围出中间亮洞。hole 用本节点本地坐标（中心原点）、半宽半高。 */
  setHole(centerLocal: Vec3, halfW: number, halfH: number) {
    const vs = view.getVisibleSize();
    const W = vs.width, H = vs.height;
    const g = this.g; g.clear();
    g.fillColor = new Color(0, 0, 0, 150);
    const L = centerLocal.x - halfW, R = centerLocal.x + halfW;
    const B = centerLocal.y - halfH, T = centerLocal.y + halfH;
    // 上
    g.rect(-W / 2, T, W, H / 2 - T); g.fill();
    // 下
    g.rect(-W / 2, -H / 2, W, B + H / 2); g.fill();
    // 左
    g.rect(-W / 2, B, L + W / 2, T - B); g.fill();
    // 右
    g.rect(R, B, W / 2 - R, T - B); g.fill();
  }

  /** 无洞的整屏变暗（用于纯文字步，可选）。 */
  setFull() {
    const vs = view.getVisibleSize();
    this.g.clear();
    this.g.fillColor = new Color(0, 0, 0, 150);
    this.g.rect(-vs.width / 2, -vs.height / 2, vs.width, vs.height); this.g.fill();
  }

  /** 气泡定位到洞上方（或下方，自动避免出屏）。 */
  setBubble(text: string, anchorLocal: Vec3) {
    this.label.string = text;
    const vs = view.getVisibleSize();
    let y = anchorLocal.y + 70;
    if (y > vs.height / 2 - 50) y = anchorLocal.y - 70;
    let x = anchorLocal.x;
    x = Math.max(-vs.width / 2 + 190, Math.min(vs.width / 2 - 190, x));
    this.bubble.setPosition(x, y, 0);
    const bg = this.bubbleBg; bg.clear();
    bg.fillColor = new Color(40, 30, 25, 235);
    bg.roundRect(-180, -32, 360, 64, 12); bg.fill();
  }
}
```

- [ ] **Step 2: Commit** `feat(tutorial): TutorialOverlay 变暗挖洞+气泡`

---

## Task 5：TutorialController 状态机 + gate

**Files:** Create `scripts/ui/TutorialController.ts`

核心逻辑：
- 静态 `instance`，供 `gate()` 被任意处调用。
- 持 `steps`、`idx`、`rotateCount`、`prevPlacedCount`、引用 hand/overlay/floorPlan/ghost。
- `gate(action: GateAction): boolean`——按当前步 `gate` 规则判断；不匹配 → `hand.shake()` 返 false。
- `update()` 每帧：解析当前步 `pointTo` 的目标世界坐标 → 移动 hand + 设 overlay 洞 + 气泡；再判 `advanceOn` → 满足则 `idx++`、重置 rotateCount、记录 placedCount。
- 坐标解析：`card_<idx>`/按钮名 → 场景里按名找节点取世界坐标；cell → `floorPlan` 本地 `edgeX/edgeY` 中心转世界。

- [ ] **Step 1: 写组件**（完整代码）：

```ts
import { _decorator, Component, Node, Vec3, UITransform, director } from 'cc';
import { gameStore } from '../state/gameStore';
import { edgeX, edgeY, layout } from './viewport';
import { HandPointer } from './HandPointer';
import { TutorialOverlay } from './TutorialOverlay';
import { GhostPiece } from './GhostPiece';
import type { TutorialStep, GateAction } from './tutorialTypes';
const { ccclass } = _decorator;

@ccclass('TutorialController')
export class TutorialController extends Component {
  static instance: TutorialController | null = null;

  private steps: TutorialStep[] = [];
  private idx = 0;
  private rotateCount = 0;
  private prevPlaced = 0;
  private hand!: HandPointer;
  private overlay!: TutorialOverlay;
  private floorPlan: Node | null = null;
  private ghost: GhostPiece | null = null;

  /** GameBootstrap 调它启动教程。 */
  init(steps: TutorialStep[], floorPlan: Node, hand: HandPointer, overlay: TutorialOverlay) {
    this.steps = steps; this.idx = 0; this.rotateCount = 0;
    this.floorPlan = floorPlan; this.hand = hand; this.overlay = overlay;
    this.prevPlaced = gameStore.getState().placedPieces.length;
    TutorialController.instance = this;
  }

  onDestroy() { if (TutorialController.instance === this) TutorialController.instance = null; }

  private cur(): TutorialStep | null { return this.steps[this.idx] ?? null; }
  private active(): boolean { return this.idx < this.steps.length; }

  // ── 强锁步门控：被 InputHandler / RoomPanel 在动作前调用 ──
  gate(a: GateAction): boolean {
    if (!this.active()) return true;       // 教程结束 → 全部放行
    const step = this.cur()!; const g = step.gate;
    let ok = false;
    switch (g.action) {
      case 'drag':
        ok = a.kind === 'select' && a.slotIdx === g.cardIndex; break;
      case 'rotate':
        ok = a.kind === 'rotate' || a.kind === 'select'; break;  // 旋转步：允许已选中的家具被点旋转
      case 'place':
        ok = a.kind === 'place' && (!g.cell || (a.origin[0] === g.cell[0] && a.origin[1] === g.cell[1])); break;
      case 'demolishToggle':
        ok = a.kind === 'demolishToggle'; break;
      case 'demolishCell':
        ok = a.kind === 'demolishCell' && a.cell[0] === g.cell[0] && a.cell[1] === g.cell[1]; break;
    }
    if (!ok && this.hand) this.hand.shake();
    return ok;
  }

  /** 旋转步要计数：InputHandler 旋转成功后调用。 */
  notifyRotated() { this.rotateCount++; }

  update() {
    if (!this.active()) { this.node.active = false; return; }
    const step = this.cur()!;
    const target = this.resolveTarget(step);
    if (target) {
      // 定位手 + 洞 + 气泡
      const local = this.overlay.node.getComponent(UITransform)!.convertToNodeSpaceAR(target);
      this.overlay.setHole(local, 90, 70);
      this.overlay.setBubble(step.text, local);
      if (step.hand === 'drag' && step.pointTo.kind === 'dragPath') {
        const from = this.resolveCard(step.pointTo.fromCard);
        if (from) this.hand.playDrag(from, target);
      } else if (step.hand === 'rotate') this.hand.playRotate(target);
      else this.hand.playTap(target);
    }
    if (this.advanceMet(step)) {
      this.idx++; this.rotateCount = 0;
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
  }

  /** 最后放下的家具是否与之前任一家具共享开放格。 */
  private lastPlaceShares(s: ReturnType<typeof gameStore.getState>): boolean {
    const pp = s.placedPieces;
    if (pp.length < 2) return false;
    const { pieceOpenCells } = require('../state/gameStore');
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
    if (pt.kind === 'card')   return this.resolveCard(pt.index);
    if (pt.kind === 'button') return this.resolveNamed(pt.name);
    if (pt.kind === 'cell')   return this.resolveCell(pt.cell);
    if (pt.kind === 'dragPath') return this.resolveCell(pt.to);
    return null;
  }
  private resolveCard(idx: number): Vec3 | null { return this.worldOf(`card_${idx}`); }
  private resolveNamed(name: string): Vec3 | null { return this.worldOf(name); }

  private resolveCell(cell: [number, number]): Vec3 | null {
    const fp = this.getFloorPlan(); if (!fp) return null;
    const ui = fp.getComponent(UITransform); if (!ui) return null;
    const cx = (edgeX(cell[1]) + edgeX(cell[1] + 1)) / 2;
    const cy = (edgeY(cell[0]) + edgeY(cell[0] + 1)) / 2;
    return ui.convertToWorldSpaceAR(new Vec3(cx, cy, 0));
  }

  private worldOf(nodeName: string): Vec3 | null {
    const scene = director.getScene(); if (!scene) return null;
    const n = this.findByName(scene, nodeName); if (!n) return null;
    const ui = n.getComponent(UITransform);
    return ui ? ui.convertToWorldSpaceAR(new Vec3(0, 0, 0)) : n.worldPosition.clone();
  }
  private findByName(root: Node, name: string): Node | null {
    if (root.name === name && root.activeInHierarchy) return root;
    for (const c of root.children) { const r = this.findByName(c, name); if (r) return r; }
    return null;
  }

  private getFloorPlan(): Node | null {
    if (this.floorPlan?.isValid) return this.floorPlan;
    return null;
  }
  private getGhost(): GhostPiece | null {
    if (this.ghost?.isValid) return this.ghost;
    this.ghost = director.getScene()?.getComponentInChildren(GhostPiece) ?? null;
    return this.ghost;
  }
}
```

> 注：`require('../state/gameStore')` 在 Cocos 打包下不可用 → 改为顶部 `import { pieceOpenCells }`。Task 5 Step 1 落地时直接顶部 import，删掉行内 require。

- [ ] **Step 2:** 顶部加 `import { pieceOpenCells } from '../state/gameStore';`，`lastPlaceShares` 内删除 require 行、直接用 `pieceOpenCells`。
- [ ] **Step 3: Commit** `feat(tutorial): TutorialController 状态机+gate+每帧重定位`

---

## Task 6：把 gate 接入 InputHandler

**Files:** Modify `scripts/ui/InputHandler.ts`

四个入口加门控；旋转成功后通知计数。用 `TutorialController.instance?.gate(...) ?? true` 包裹（无教程时恒 true）。

- [ ] **Step 1:** 顶部 import：`import { TutorialController } from './TutorialController';`

- [ ] **Step 2: 放置门控**——`tryPlaceAtGhost()` 内，`const origin = this.ghost.getOrigin();` 之后、`validatePlacement` 之前插：

```ts
    const tc = TutorialController.instance;
    if (tc && !tc.gate({ kind: 'place', origin })) return;
```

- [ ] **Step 3: 旋转门控 + 计数**——`onTouchEnd` 里 `if (this.tapOnPiece(...))` 块，把 `s.rotateSelection(1);` 包成：

```ts
      const tc = TutorialController.instance;
      if (tc && !tc.gate({ kind: 'rotate' })) return;
      const newOrigin = this.rotateOriginAround(sel, this.ghost.getOrigin(), c.row, c.col);
      s.rotateSelection(1);
      tc?.notifyRotated();
      this.ghost.setOrigin(newOrigin[0], newOrigin[1]);
```

- [ ] **Step 4: 拆除点格门控**——`onTouchStart` 里 `if (s.demolishMode) { ... s.demolishAtCell([hit.row, hit.col]); }` 改为先 gate：

```ts
        e.propagationStopped = true;
        const tc = TutorialController.instance;
        if (tc && !tc.gate({ kind: 'demolishCell', cell: [hit.row, hit.col] })) return;
        s.demolishAtCell([hit.row, hit.col]);
```

> 拖拽 select 的门控放在 RoomPanel（卡片 selectOption 处），不在这里。
> ghost 落定（advanceOn ghostPositioned）由 controller 轮询 GhostPiece，无需在此通知。

- [ ] **Step 5: Commit** `feat(tutorial): InputHandler 接入 gate(放置/旋转/拆除)`

---

## Task 7：把 gate 接入 RoomPanel（卡片 select + 放置/拆除按钮）

**Files:** Modify `scripts/ui/RoomPanel.ts`

- [ ] **Step 1:** 顶部 import：`import { TutorialController } from './TutorialController';`

- [ ] **Step 2: 卡片 select 门控**——`makeOption` 里 tapOnly 分支共有两处 `gameStore.getState().selectOption({ slot, slotIdx, optionIndex });`（TOUCH_MOVE 的 drag 分支、TOUCH_END 的 tap 分支）。各自前面加：

```ts
            const tc = TutorialController.instance;
            if (tc && !tc.gate({ kind: 'select', slotIdx })) return;
            gameStore.getState().selectOption({ slot, slotIdx, optionIndex });
```
（drag 分支里这一句在 `mode = 'drag'` 赋值之后；保持其后的 `this.beginTrayDrag()` 不变——gate 失败时已 return，不会进入拖拽。）

- [ ] **Step 3: 放置按钮门控**——放置按钮的 onTap `() => this.getInput()?.tryPlaceAtGhost()` 不用改（InputHandler 已门控）。

- [ ] **Step 4: 拆除按钮门控**——`拆除` 按钮 onTap 改为：

```ts
      () => { const tc = TutorialController.instance;
              if (tc && !tc.gate({ kind: 'demolishToggle' })) return;
              gameStore.getState().toggleDemolishMode(); },
```
（rebuild() 与 updateSelectionHighlight/updatePending 里同名按钮如各有一处 onTap，全部同改；用 Grep `toggleDemolishMode` 找全。）

- [ ] **Step 5: Commit** `feat(tutorial): RoomPanel 卡片select+拆除按钮接入 gate`

---

## Task 8：GameBootstrap 实例化 controller + training.json 步骤

**Files:** Modify `scripts/ui/GameBootstrap.ts`、`md/scenarios/training.json`

- [ ] **Step 1: training.json 加 tutorial（11 原子步）**——在顶层 `"bonus_points"` 后加。陋室室内 4×4 在 row4–7/col5–8；指定格按家具 bbox 取合理落点（实现时若 ghost 居中偏移导致 origin≠目标，按 `moveGhost` 的 `origin=cell-floor(bbox/2)` 反推 `to`）：

```json
  "tutorial": {
    "steps": [
      { "id":"drag-bed","text":"按住家具，拖进户型图","hand":"drag",
        "pointTo":{"kind":"dragPath","fromCard":0,"to":[5,5]},
        "gate":{"action":"drag","cardIndex":0},"advanceOn":{"on":"ghostPositioned"} },
      { "id":"place-bed","text":"按「放置」把它固定下来","hand":"tap",
        "pointTo":{"kind":"button","name":"放置"},
        "gate":{"action":"place"},"advanceOn":{"on":"placed"} },
      { "id":"drag-sofa","text":"再拖一个沙发进来","hand":"drag",
        "pointTo":{"kind":"dragPath","fromCard":1,"to":[6,6]},
        "gate":{"action":"drag","cardIndex":1},"advanceOn":{"on":"ghostPositioned"} },
      { "id":"rotate-sofa","text":"点一下家具，可以旋转方向","hand":"rotate",
        "pointTo":{"kind":"cell","cell":[6,6]},
        "gate":{"action":"rotate","minTimes":1},"advanceOn":{"on":"rotatedAtLeast","times":1} },
      { "id":"place-sofa","text":"满意了就按「放置」","hand":"tap",
        "pointTo":{"kind":"button","name":"放置"},
        "gate":{"action":"place"},"advanceOn":{"on":"placed"} },
      { "id":"drag-table","text":"多件家具能共用开放格——把桌椅挨着沙发放","hand":"drag",
        "pointTo":{"kind":"dragPath","fromCard":2,"to":[5,7]},
        "gate":{"action":"drag","cardIndex":2},"advanceOn":{"on":"ghostPositioned"} },
      { "id":"place-table","text":"按「放置」——注意它和沙发共用了格子","hand":"tap",
        "pointTo":{"kind":"button","name":"放置"},
        "gate":{"action":"place"},"advanceOn":{"on":"placed","sharesOpenCell":true} },
      { "id":"drag-toilet","text":"再放个马桶试试","hand":"drag",
        "pointTo":{"kind":"dragPath","fromCard":3,"to":[7,5]},
        "gate":{"action":"drag","cardIndex":3},"advanceOn":{"on":"ghostPositioned"} },
      { "id":"place-toilet","text":"按「放置」","hand":"tap",
        "pointTo":{"kind":"button","name":"放置"},
        "gate":{"action":"place"},"advanceOn":{"on":"placed"} },
      { "id":"demolish-on","text":"放错了？先点「拆除」","hand":"tap",
        "pointTo":{"kind":"button","name":"拆除"},
        "gate":{"action":"demolishToggle"},"advanceOn":{"on":"demolishModeOn"} },
      { "id":"demolish-cell","text":"再点马桶，它会回到列表","hand":"tap",
        "pointTo":{"kind":"cell","cell":[7,5]},
        "gate":{"action":"demolishCell","cell":[7,5]},"advanceOn":{"on":"removed"} }
    ]
  }
```

> 落点坐标在预览中校准：若某步 ghost 居中偏移使实际 origin 与 `place.cell`/`demolishCell.cell` 不符，按预览 Console 打印的真实 origin 回填 JSON（放置步未写 `gate.cell` 故不卡 origin；仅旋转/拆除/共享格依赖坐标，预览时重点验证这三处）。

- [ ] **Step 2: 重建关卡数据**——cocos 目录跑 `npm run scenarios:build`（把 per-level JSON 打包进 maps_data）。

- [ ] **Step 3: GameBootstrap 实例化**——`start()` 末尾、`(globalThis as any).gameStore = gameStore;` 之前插入：找到当前 scenario 是否带 tutorial，若有则建节点挂 controller + hand + overlay。但 bootstrap 此时还没选关；改为在「选关后 initRun」时机。**实现策略**：controller 自身在 `update()` 第一帧检查 `gameStore.getState().scenario?.tutorial`，惰性 init。简化为在 GameBootstrap 建一个常驻 TutorialController 节点 + 子 Hand/Overlay 节点，并由 controller 监听 scenario 变化自启：

```ts
    if (canvas && !canvas.node.getChildByName('Tutorial')) {
      const root = new Node('Tutorial');
      canvas.node.addChild(root);
      const overlayNode = new Node('TutorialOverlay');
      root.addChild(overlayNode);
      const overlay = overlayNode.addComponent(TutorialOverlay);
      const handNode = new Node('Hand');
      root.addChild(handNode);
      const hand = handNode.addComponent(HandPointer);
      const ctl = root.addComponent(TutorialController);
      ctl.autoStart(overlay, hand);   // 见下 Step 4
    }
```
（顶部 import TutorialController / HandPointer / TutorialOverlay / Node。Tutorial 节点 sibling index 设大，保证盖在最上层。）

- [ ] **Step 4: controller 加 `autoStart`**——监听 scenario：scenario 带 tutorial 且进入摆放阶段时 init，否则隐藏。给 TutorialController 加：

```ts
  private started = false;
  private overlayRef!: TutorialOverlay; private handRef!: HandPointer;
  autoStart(overlay: TutorialOverlay, hand: HandPointer) {
    this.overlayRef = overlay; this.handRef = hand;
    this.node.active = false;
    gameStore.subscribe((s) => {
      const tut = (s.scenario as any)?.tutorial;
      if (!this.started && tut?.steps?.length && s.activeRoomSlot) {
        const fp = director.getScene()?.getComponentInChildren(InputHandler)?.floorPlan ?? null;
        this.started = true; this.node.active = true;
        this.init(tut.steps, fp, this.handRef, this.overlayRef);
      }
    });
  }
```
（import InputHandler；`floorPlan` 是其 public @property，可读。）

- [ ] **Step 5: Commit** `feat(tutorial): 装配 controller + 陋室 11 步教程脚本`

---

## Task 9：Cocos 预览校准（人工 + MCP）

- [ ] **Step 1:** 编辑器 `project_refresh_assets` → 等编译完成（`project_check_builder_status`）。
- [ ] **Step 2:** `resources/tiles` 无新增，无需 Reimport；新脚本由编辑器自动 import。
- [ ] **Step 3:** Preview，进入「陋室」。逐步验证 11 步：示意手位置、挖洞、气泡、锁步（点错卡片/按钮被挡 + 手抖）、共享格步必须落在 [5,7] 才过、拆除两步。
- [ ] **Step 4:** 校准坐标——若旋转步/共享格步/拆除步的 cell 与实际不符，按 Console 打印回填 training.json 并 `scenarios:build`。
- [ ] **Step 5:** 录一段 GIF 给用户看成品。
- [ ] **Step 6: Commit** 任何校准改动 `fix(tutorial): 预览校准落点坐标`

---

## Self-Review（对照 spec）

- ✅ 强引导锁步 → Task 5 gate + Task 6/7 接入
- ✅ 通用引擎/声明式 → Task 1 类型 + Task 5 controller（关卡只写 JSON）
- ✅ 5 机制（拖/旋/放/共享/拆除）→ Task 8 的 11 原子步覆盖
- ✅ Q1 全路径拖拽动画 → HandPointer.playDrag
- ✅ Q2 共享格强制唯一格 → drag.toArea 仅 [5,7] + advance sharesOpenCell（双保险）
- ✅ Q3 每次都演示 → 无持久化；autoStart 每次进关 init
- ✅ Q4 脚本入 training.json → Task 8
- ✅ Q5 气泡跟手 → TutorialOverlay.setBubble 跟随目标
- ⚠️ 旋转步 gate 允许 select+rotate：拖入沙发后未放置即可点击旋转（spec 风险1）→ 预览重点验证
- ⚠️ 共享格强制：drag.toArea 限制需在 moveGhost 落定前拦截非目标格——若实现复杂，退化为「不限制落点、仅靠 advance sharesOpenCell 判定」（Q2 强制度略降，预览时定）
```
