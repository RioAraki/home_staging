# 通用强引导教程系统 · 设计稿（首关「陋室」）

> 日期：2026-06-28（2026-06-28 修订：撤销 → 拆除，见下）
> 状态：设计已与用户确认（5 项决策已拍板），待用户审阅 spec → 进入实现计划。

> **修订说明**：主干 commit `52f8b8b` 在摆放阶段**移除了「撤销」按钮，由「拆除」取代**
> （`f561625` 引入）。因此第 5 个教学机制从「撤销」改为「拆除」——点「拆除」进入拆除模式，
> 再点户型图上已放的家具把它退回家具列表。本 spec 已据此更新。

## 1. 目标与现状

**目标**：让新手在第一关「陋室」里被示意手一步步带着学会 5 个核心操作——
**拖拽 → 旋转 → 放置 → 共享开放格 → 拆除**；并把它做成一套**数据驱动、声明式、可跨关卡复用**的教程引擎，
使陋室之后的关卡只需再写一份 `tutorial.steps` 就能挂上循序渐进的教学。

**现状（已核对代码）**：
- `md/scenarios/training.json` = 陋室，难度 `training`，4×4 室内房（`I` 格在 row 4–7, col 5–8），共 **7 件家具**：
  单人床 → 沙发 → 桌椅组合2 → 马桶 → 猫 → 粉植物 → 猫砂。无任何教程字段。
- 交互全在 `cocos/.../scripts/ui/InputHandler.ts`（拖拽 ghost、点击旋转、拖放、`demolishMode` 下点格拆除）+
  `state/gameStore.ts`（`placeSelected` / `rotateSelection` / `toggleDemolishMode` / `demolishAtCell`）。
- `RoomPanel.ts` 摆放阶段动态建出三颗按钮：绿色「放置」（`tryPlaceAtGhost()`）、琥珀「拆除」
  （`toggleDemolishMode()`，进入拆除模式后点已放家具→`demolishAtCell` 退回列表）、红色「完成摆放」。**撤销已不在摆放阶段**。
  旋转 = 点击户型图上已拖入的 ghost。
- `gameStore.subscribe(state, prev)` 可监听所有玩家动作；可作为教程推进信号源，零侵入游戏逻辑。
- 已有可复用的全屏变暗覆盖层套路（`EndGameScreen` / `FloorPlan` 的 `Graphics` 蒙版）。无任何示意手 / 高亮 / 分步引导。

## 2. 已确认的设计决策

| # | 决策 | 选择 |
|---|------|------|
| Q1 | 示意手动画精度 | **全路径拖拽动画**（手从卡片真的滑到目标格，循环播放） |
| Q2 | 第 4 步「共享开放格」强制度 | **强制放到唯一指定格**（最强引导，必然产生开放格共享） |
| Q3 | 教程是否只演示一次 | **每次进陋室都完整演示** → 不做 localStorage 持久化 |
| Q4 | 步骤脚本存放 | 放进 `md/scenarios/training.json` 的 `tutorial` 字段（跟关卡数据走，build 流程不变） |
| Q5 | 文字提示位置 | **跟随示意手的气泡** |

教程强制程度：**强引导（锁步）**——玩家只能做"当前步要求的动作"，其余被温和拦截。
关卡范围：**保留 7 件家具不动**，前 4 件每件承担一个教学点，后 3 件（猫/粉植物/猫砂）自由摆放。

## 3. 引擎架构

一个状态机 + 三个表现层 + 一道门控：

```
training.json (tutorial.steps[])
        │  GameBootstrap 加载关卡时读取
        ▼
   TutorialController  ← 新组件，步骤状态机
   ├─ 当前步驱动 → HandPointer（示意手覆盖层，全路径动画/脉冲/旋转）
   ├─ 当前步驱动 → TutorialOverlay（全屏变暗 + 给目标挖高亮洞 + 跟随气泡）
   └─ gate(action, target)  ← InputHandler / RoomPanel 在动作执行「前」询问
                              不允许 → return + 示意手抖动
                              允许   → 正常执行 select/place/rotate/demolish
        │
        ▼  gameStore.subscribe 检测到当前步 advanceOn 条件
   跳下一步 …… 步骤用尽 → 关闭教程，恢复完全自由操作
```

三条核心原则：**声明不写死**（每关只是一份 JSON）、**门控=强引导**（动作入口拦截）、**监听不轮询**（复用 `gameStore.subscribe`）。

## 4. 声明式步骤格式（通用 schema）

```ts
export interface TutorialStep {
  id: string;                       // 唯一标识
  text: string;                     // 跟随手的气泡文字
  pointTo: PointTarget;             // 示意手指向谁
  hand: 'drag' | 'tap' | 'rotate';  // 手势动画类型
  gate: GateRule;                   // 本步只放行的动作
  advanceOn: AdvanceRule;           // 满足即跳下一步
}

type PointTarget =
  | { kind: 'card'; index: number }
  | { kind: 'button'; name: '放置' | '拆除' }
  | { kind: 'cell'; cell: [number, number] }
  | { kind: 'dragPath'; from: PointTarget; to: [number, number] };

type GateRule =
  | { action: 'drag'; cardIndex: number; toArea?: [number, number][] }
  | { action: 'rotate'; minTimes: number }
  | { action: 'place'; cell?: [number, number] }
  | { action: 'demolishToggle' }                       // 点「拆除」进入拆除模式
  | { action: 'demolishCell'; cell: [number, number] };// 点指定已放家具退回列表

type AdvanceRule =
  | { on: 'ghostPositioned' }
  | { on: 'placed'; sharesOpenCell?: boolean }
  | { on: 'rotatedAtLeast'; times: number }
  | { on: 'demolishModeOn' }                           // demolishMode 变 true
  | { on: 'removed' };                                 // placedPieces 数量减少
```

`gate.action` 只认游戏已有的动作枚举 `select / drag / rotate / place / demolishToggle / demolishCell`，引擎对所有未来关卡通用，新关卡无需改引擎。

存放（Q4）：直接作为 `training.json` 顶层的 `tutorial` 对象：
```json
"tutorial": {
  "steps": [ /* 见第 5 节映射 */ ]
}
```
> 注：因 Q3 选「每次都演示」，schema 不含 `playOnce` 字段，引擎每次加载有 `tutorial` 的关卡都从第一步开始。

## 5. 陋室分步流程（4 件家具教 5 个机制）

| # | 家具 | 教学点 | 示意手 | 气泡文字 | gate（只允许） | advanceOn |
|---|------|--------|--------|----------|----------------|-----------|
| 1 | 单人床 | 拖拽 | 全路径：卡片→室内格 | 按住家具，拖进户型图 | `drag` 1 号卡片，ghost 仅限室内 | `ghostPositioned` |
| 2 | 单人床 | 放置键 | 指向绿「放置」脉冲 | 按「放置」把它固定下来 | `place` | `placed` |
| 3 | 沙发 | 旋转 | 拖入→点沙发旋转 | 点一下家具，可以旋转方向 | 拖入 → `rotate`(≥1) → `place` | `rotatedAtLeast:1` 后 `placed` |
| 4 | 桌椅组合2 | 共享开放格 | 全路径拖到唯一指定格 | 多件家具能共用开放格——把桌椅挨着沙发放 | `drag` 至指定单格 → `place` | `placed` 且 `sharesOpenCell` |
| 5a | 马桶 | 拆除①进模式 | 放好马桶后指向「拆除」脉冲 | 放错了？先点「拆除」 | 放马桶 → `demolishToggle` | `demolishModeOn` |
| 5b | 马桶 | 拆除②点家具 | 指向户型图上的马桶脉冲 | 再点要退回的家具，它会回到列表 | `demolishCell`(马桶所在格) | `removed` |
| 6 | 猫/粉植物/猫砂（+退回的马桶） | 自由 | 手淡出 | 剩下的交给你，自由摆放完成房间！ | 全部解锁 | 教程结束 |

**第 4 步（Q2 强制唯一格）**：步骤里写死目标格 `to:[r,c]`，使桌椅的开放格与沙发的开放格必然贴合；
`toArea` 只含这一格，玩家拖到别处 ghost 不落，被门控挡回。`advanceOn` 额外校验 `sharesOpenCell`（放置后比对开放格集合是否与已有家具相交），双保险。

## 6. 强引导（锁步）实现机制

1. **动作门控（逻辑层）**：在 `InputHandler` 的拖拽/旋转/放置入口、`onTouchStart` 里 `demolishMode` 的点格拆除入口、
   以及 `RoomPanel` 的「放置」/「拆除」按钮回调入口，各加一句 `if (!Tutorial.gate(action, target)) return;`。
   不允许的动作直接 return，并触发示意手抖动。已有逻辑零改动，只在门口拦。
2. **挖洞遮罩（表现层）**：复用 `EndGameScreen` 全屏 `Graphics` 变暗套路，在当前步目标元素位置挖一个亮洞
   （目标卡片 / 「放置」「拆除」按钮 / 指定格子），视觉上把"能点的地方"锁死成唯一。

> **拆除是两步**（5a/5b）：先点「拆除」进 `demolishMode`（gate `demolishToggle`、advance `demolishModeOn`），
> 再点户型图上的马桶格触发 `demolishAtCell`（gate `demolishCell`、advance `removed`）。两步分别挖洞、分别门控。

**示意手三种手势**（Q1）：
- `drag`：手沿 from→to 路径平移，循环播放（全路径，最直观）。
- `tap`：手在目标按钮上方一缩一放脉冲。
- `rotate`：手带小弧线箭头，暗示点击会转向。

气泡（Q5）跟随手节点，显示该步 `text`。

## 7. 落地改动清单

| 文件 | 动作 | 说明 |
|------|------|------|
| `scripts/ui/TutorialController.ts` | 新增 | 步骤状态机 + `gate()` + 订阅推进 |
| `scripts/ui/HandPointer.ts` | 新增 | 示意手节点 + 三种动画（drag/tap/rotate） |
| `scripts/ui/TutorialOverlay.ts` | 新增 | 挖洞变暗遮罩 + 跟随气泡 |
| `md/scenarios/training.json` | 编辑 | 加 `tutorial.steps`（7 件家具不动） |
| `scripts/ui/InputHandler.ts` | 编辑 | 拖/旋转/放置入口 + `onTouchStart` 拆除点格入口加 `gate()` |
| `scripts/ui/RoomPanel.ts` | 编辑 | 放置/拆除按钮回调加 `gate()` |
| `scripts/ui/GameBootstrap.ts` | 编辑 | 关卡含 `tutorial` 时实例化 controller |
| `resources/.../hand.png` + `.meta` | 新增 | Kenney Cursor Pack（CC0）手图标，`trimType:none` |

## 8. 实现期需核对的风险

1. **旋转判定边界**：第 3 步旋转目前是「点击户型图上已拖入的 ghost」（`InputHandler.onTouchEnd` 的 `rotateOriginAround`）。
   锁步时需保证：沙发拖入后、放置前仍能点击旋转，且 `gate` 仅在"旋转过 ≥1 次"后才放行「放置」。写实现计划时先核对该判定的命中区域与阈值再开工。
2. **挖洞洞口坐标**：`RoomPanel` 按钮、卡片均为运行时动态布局，需向 controller 暴露目标节点的世界坐标/包围盒以定位高亮洞，不能写死像素。
3. **拆除两步的时序**：点「拆除」后 `demolishMode` 变 true 会触发 RoomPanel 全量 `rebuild()`（按钮节点重建），
   controller 的挖洞/门控需在 rebuild 后重新定位「拆除」按钮与目标家具格；advance 用 `placedPieces` 数量减少判定 `removed`，避免误判。
4. **示意手资产**：Kenney Cursor Pack 的手 PNG 放进 `resources` 必须按规范同写 `trimType:none` 的 `.meta`（否则 auto-trim 拉伸），并在编辑器内 Reimport。

## 9. 资产来源

示意手图标：**Kenney Cursor Pack**（CC0，公共领域，可商用免署名）。
下载：https://kenney.nl/assets/cursor-pack
