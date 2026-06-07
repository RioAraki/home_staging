# 固定裁剪地图 + 取消缩放/拖动 — 设计文档

- 日期：2026-06-02
- 范围：Cocos 版（`cocos/home-staging-cocos/`），面向微信小游戏
- 目标：把地图从 16×16 的"大施工场地"收缩到只显示真正的房间区域（indoor），固定铺满屏幕中间区，**彻底取消缩放和拖动**。

## 背景与动机

当前地图固定 16×16（`LayerRenderer.ts` 中 `CELL_SIZE=40 / GRID_ROWS=16 / GRID_COLS=16`），但每个关卡真正的房间只是正中间的一小块 `indoor` 区（训练关只有 6×6），外面一大圈是 `outdoor`（绿色施工场地）。

后果：
- 手机上格子被挤得很小 → 误触、难画。
- 玩家需要双指缩放 + 拖动才能看清/操作 → 对微信小游戏用户过于复杂。

目的：**把地图固定死**——裁剪到房间区 + 少量边距，按屏幕中间可用区域一次性铺满，去掉 `PanZoomContainer` 的缩放和拖动。

## 关键约束：保留 1–2 格 outdoor 边距

`outdoor` 不全是装饰，部分关卡玩法挂在上面：
- 大门必须画在**外墙**上 → 外墙外要有 outdoor 格可接门 + 走廊。
- "朝某向的窗""透过窗望见 X"类奖励分依赖窗外 outdoor。
- 个别关卡（商店）把 outdoor 楔形格当门用。

所以**不能全删 outdoor**。裁剪范围 = `indoor` 包围盒 + `MAP_CROP_MARGIN` 圈 outdoor 边距。

- `MAP_CROP_MARGIN` 默认 = **2**（全局常量）。
- 边距外的 outdoor 不渲染、不可交互。
- 逐关验证：默认 2 格通常够放大门 + 走廊；若某关走廊绕不开，再加按关覆盖（暂不做，等真有关卡需要时再加）。

## 设计

核心思想：**只改"视图"，不改"数据/逻辑"。** 计分、校验、区域连通、墙体仍按原始 16×16 坐标运算；改变的只是哪些格子被画、画多大、画在哪。

### 1. 新增视图布局模块 `ui/viewport.ts`

加载关卡时计算一次，产出一个共享布局对象 `MapLayout`：

```
interface MapLayout {
  cell:      number;  // 动态格子边长（像素）
  r0, c0:    number;  // 裁剪范围左上角（原始网格坐标）
  rows, cols:number;  // 裁剪后行列数
  w, h:      number;  // 裁剪后像素宽高 = cols*cell, rows*cell
}
```

计算步骤：
1. 扫描 `scenario.grid.ascii` + `legend`，求出 `terrain === 'indoor'` 所有格子的包围盒 `[minR,minC,maxR,maxC]`。
2. 加边距并夹到 16×16 内：`r0 = max(0, minR - MARGIN)`，`c0 = max(0, minC - MARGIN)`，下/右同理。`rows = r1-r0+1`，`cols = c1-c0+1`。
3. 取中间可用屏幕区域尺寸 `availW × availH`（FloorPlan 父容器的 UITransform），`cell = floor(min(availW/cols, availH/rows))`。
4. `w = cols*cell`，`h = rows*cell`，地图居中：x ∈ [-w/2, w/2]，y ∈ [-h/2, h/2]。

提供统一坐标换算（替换现在散落在各文件里的内联算式）：
- `cellToScreen(r, c) -> {x, y}`（含 Cocos y 轴向上的翻转）
- `screenToCell(x, y) -> {r, c}`（FloorPlan 局部坐标 → 原始网格坐标）
- `edgeHitTest(x, y) -> HitResult`（把 `InputHandler.hitTest` 的边线判定搬过来，用 `cell` 而非常量）

### 2. 4 个文件改用 `MapLayout`，弃用写死常量

- `LayerRenderer.ts`：`drawGridBg / drawWalls / drawDoors / drawWindows / drawPreDrawn` 全部循环裁剪范围 `r0..r1, c0..c1`，坐标走 `cellToScreen`。导出的 `CELL_SIZE/GRID_ROWS/GRID_COLS` 常量移除或改为从 `MapLayout` 读。
- `InputHandler.ts`：`hitTest` 改调 `viewport.screenToCell / edgeHitTest`。
- `GhostPiece.ts` / `PlacedPiece.ts`：定位改用 `cellToScreen` + 动态 `cell`。

注意：所有这些坐标仍是**原始 16×16 网格坐标**（如门 key `h:r:c` 里的 r,c 不变），只有"画到屏幕哪个像素"变了。计分/校验拿到的坐标完全一致。

### 3. 去掉缩放和拖动

- 停用 `PanZoomContainer`：移除组件，或抽空其 touch/wheel 处理，固定 `content.scale = 1`、`position = (0,0)`。
- 确保 FloorPlan 静态居中、完整可见，触摸事件直达 `InputHandler`（不再被容器的拖动逻辑截走）。

### 4. 不改动的部分

- 关卡数据 / ascii / 所有坐标
- `core/scoring.ts`、`core/validation.ts`、`core/regions.ts`、`core/walls.ts`
- `gameStore` 状态

## 边界 / 错误处理

- 关卡没有 indoor 格（理论上不该发生）：回退为整张 16×16，记一条 `console.warn`。
- 裁剪范围算出 `cell` 过小（屏幕太窄）：仍按 fit 计算，不设下限（地图始终完整可见优先于格子最小尺寸）。
- 屏幕尺寸：以加载时父容器尺寸为准；本期不处理运行中旋转/resize（微信小游戏竖屏固定）。

## 测试

- `core/*` 逻辑无改动，原有 vitest 测试应继续全绿（回归保护）。
- 新增 `viewport` 纯函数单测：给定一段 ascii + margin + 可用尺寸，断言 `r0/c0/rows/cols/cell` 和 `cellToScreen/screenToCell` 互逆。
- 手动冒烟（微信开发者工具）：训练关加载后地图居中铺满、绿色边大幅减少、双指缩放/拖动无效、放家具/画墙/放门坐标正确、可正常通关结算。

## 验收标准

1. 训练关加载后，地图只显示房间区 + 约 2 格边距，铺满中间区、静态居中。
2. 双指缩放、拖动、滚轮缩放全部无效。
3. 放家具、画墙、放门、窗、大门、拆除的落点与裁剪前在逻辑上一致（计分不变）。
4. 抽查若干关卡仍可通关（大门 + 走廊放得下）。
5. `core/*` 原有测试全绿。
