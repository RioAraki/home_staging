# Ghost 预测性「困住家具」标红

日期：2026-06-14

## 背景 / 问题

家具有「外形格」(shape) 和「open cell」(操作空间，必须保持可走到)。规则上，open cell 不可达的家具会在结算时被忽略 (`analyseOpenSpaceAccessibility` / `scoring.ts`)。

当前 `FloorPlan.redrawInaccessibleOpen()` 已经能算这件事——它把「可走但不可达」的 open cell 红洗——但只在**落子之后**(`placedPieces` 变化时)运行。

问题场景：玩家把一块家具拖到某处，会让周围一圈家具把某个 open cell 完全围死，导致这些家具的 open cell 全部不可达。玩家在落子前看不到任何警告。

## 目标

在 **ghost 悬停 / 拖动时**就预测：把 ghost 算进占位后，哪些家具的 open cell 变得不可达，把这些家具的**外形 + open cell 标红**。

**包括 ghost 自身**：若放置后 ghost 自己的 open cell 也不可达，ghost 外形 + 那些 open cell 一并标红。

**仅警告，不阻断**：落子合法性仍由 `validatePlacement` 决定；本检查不让 ghost 变「非法/不可落子」。这与现有 `redrawInaccessibleOpen`「只警告、结算时忽略」的语义一致。

## 设计

### 1. 抽取共享可达性内核 (`core/regions.ts`)

新增纯函数：

```ts
export function computeFloorReachability(
  scenario: Scenario,
  placedPieces: PlacedPiece[],
  walls: Record<string, true>,
  doors: Record<string, RoomSlot>,
  frontDoorEdge: string | null,
  extraBlockedShape?: Set<string>,   // ghost 外形格(世界坐标 "r,c")
): { walkable: Set<string>; reachable: Set<string> }
```

逻辑照搬 `redrawInaccessibleOpen` 现有 BFS：
- `allBlocked` = 非地毯外形格 ∪ `extraBlockedShape`
- `walkable` = 室内格 − `allBlocked`
- 种子 = 玩家门 / 前门 / 预绘门两侧的 walkable 格；无门时回退到任一非 open-space 的裸地板格
- 沿墙 BFS(墙挡，门是开口自然穿过)

`FloorPlan.redrawInaccessibleOpen()` 改用此函数(删去内联 BFS，保留自己的 `allOpenSpaces` 收集与最终筛选)，避免两处逻辑分叉。

### 2. GhostPiece 预测性标红 (`ui/GhostPiece.ts`)

在 `draw()` 中，ghost 已定位且未处于抑制阶段时：
1. `extraBlockedShape` = ghost 外形格 → 调 `computeFloorReachability` 得 `{walkable, reachable}`。
2. 对每个**已放置家具**：若其任一 open cell ∈ walkable 且 ∉ reachable → 该家具被困 → 画红：外形格(半透明红填充+红边) + 不可达的 open cell(红框+红圈)。
3. 对 **ghost 自身**：同样判定它自己的 open cell；被困则 ghost 外形 + 不可达 open cell 标红。

### 3. 阶段抑制(与 `redrawInaccessibleOpen` 一致)

- `wallPhase === 'walls'`：跳过(画墙时 open cell 临时被围是正常的)。
- `wallPhase === 'door'` 且当前 `activeRoomSlot` 还没放过任何门：跳过。

### 4. 保留现有直接遮盖高亮

GhostPiece 现有「ghost 外形直接压住某 open cell → 红圈」(GhostPiece.ts:114-143) 保留。那是「直接遮盖」(且会让落子非法)，本功能处理「间接围死」，互补。

## 数据流

拖动 → `GhostPiece.draw()` → `computeFloorReachability(含 ghost 外形)` → 逐家具(含 ghost)判困 → 红色覆盖层。网格 16×16，每次拖动一次 BFS，开销可忽略。

## 不做 (YAGNI)

- 不阻断落子、不改 `validatePlacement`。
- 不改结算逻辑(`scoring.ts` 已正确忽略不可达家具)。
- 不做动画 / 文案提示，只标红。

## 依赖检查

`regions → walls` (新增 `doorEdgeKey` 引用) 为单向，无循环 (`walls.ts` 不引用 `regions.ts`)。
