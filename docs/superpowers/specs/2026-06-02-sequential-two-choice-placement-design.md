# 顺序卡 + 二选一摆放 + 阶段门控 — 设计文档

- 日期：2026-06-02
- 范围：Cocos 版（`cocos/home-staging-cocos/`），面向微信小游戏
- 目标：把家具摆放交互从"全摊开、随便挑、随时能造墙"改成"按顺序逐张出卡、每卡二选一、家具阶段与造墙阶段分离"，并把旋转改成滑动手势。

## 背景

当前（`RoomPanel`）把一个房间的所有家具卡横向全摊开，玩家可从任意一张开始；选项选择 + 旋转/镜像/放置都通过 `SelectionStatus` 的按钮；造墙/门和放家具混在一起随时可做 → 模式过载、对微信小游戏过于复杂。

数据事实：**66 张卡每张恰好 2 个选项**（`option_index` 仅 1、2），所以"二选一"与数据天然吻合。每个家具编号有变体 A/B，开局随机定一个（`chosenVariants`，保持不变）。

## 新交互流程

1. 选房间 → 该房间 `furniture_numbers` 按**固定顺序**逐张出卡（前进，不回退）。
2. 当前卡 = 已定变体的那张卡，展示它的 **2 个选项**，玩家**二选一**（点其一选中，点另一个可改选）。
3. 选中后：
   - 底部家具区：**左右滑动 = 旋转 90°**（右滑顺时针 `rotation+1`，左滑逆时针 `rotation-1`）；**镜像 = 按钮**（万能牌，每局限一次，用完置灰）。
   - 户型图：出现幽灵，**手指滑动移动位置**；图上不旋转、不放置。
   - 底部 **确定** → 校验并放置；底部 **跳过** → 不放，进下一张。
4. 一张卡确定/跳过后 `currentCardIndex + 1`；本房间所有卡处理完 → **自动**进入造墙阶段。
5. **阶段门控**：家具阶段工具栏的墙/门/窗/大门/拆除全部禁用置灰；造墙阶段才点亮。封墙完成进下一房间，回到家具阶段。

## 状态模型（gameStore）

新增（均纳入可撤销快照 `Undoable`）：
- `currentCardIndex: number` — 当前房间内的顺序指针，进房间归 0。
- `roomPhase: 'furniture' | 'construction'` — 进房间为 `furniture`；当前房间最后一张卡 resolved 后置 `construction`。

派生/动作调整：
- `enterRoom(slot)`：设 `activeRoomSlot=slot`、`currentCardIndex=0`、`roomPhase='furniture'`、清 `selectedOption`。
- 当前卡 = `cardByNumberVariant(room.furniture_numbers[currentCardIndex], chosenVariants[number])`。
- `selectOption(optionIndex)`：只接受 1|2，针对当前卡建立 `selectedOption`（保持 `rotation=0, mirrored=false`）。
- `rotateSelection()`：保留；新增允许逆时针（`(rotation+3)%4`）供左滑用，或复用 `rotation+1`（右滑）。
- `mirrorSelection()`：保留现有万能牌门控（`jokerUsed`）。
- `placeSelected(origin)`：校验通过后放置 → 标记当前卡 placed → `advanceCard()`。
- `skipCard()`：标记当前卡 skipped → `advanceCard()`。
- `advanceCard()`：`currentCardIndex+1`；若越过本房间末张 → `roomPhase='construction'`，清 `selectedOption`。
- 造墙/门/窗/大门/拆除相关动作（`toggleWall/setDoor/toggleWindow/setFrontDoor/toggle*Mode`）：当 `roomPhase!=='construction'` 时直接 return（防御式拦截，UI 也置灰）。

## 组件改动（尽量复用现有场景节点，少动连线）

- **CardChooser（由 RoomPanel 改造）**：不再渲染全部卡，只渲染**当前卡的 2 个选项**两张缩略图（复用 `CardItem` 渲染），点击选中其一；在选中的缩略图节点上挂左右滑动手势 → 调 `rotateSelection`。订阅 `currentCardIndex / activeRoomSlot / selectedOption` 变化重建。
- **按钮复用（SelectionStatus / Toolbar 现有节点）**：
  - `PlaceBtn` → "确定"（`tryPlaceAtGhost`，已有）。
  - `CancelBtn` → "跳过"（`skipCard`）。
  - `MirrorBtn` → 镜像（万能牌门控，用完置灰）。
  - `RotateBtn` → 隐藏（旋转改手势）。
- **InputHandler**：`roomPhase==='furniture'` 时，`onTouchStart` 的边线路由（造墙/门/窗/大门/拆除）一律不执行；仅当有 `selectedOption` 时滑动移动幽灵。放置仍只走"确定"按钮。
- **Toolbar**：订阅 `roomPhase`，家具阶段禁用并置灰墙/门/窗/大门/拆除/完成房间按钮；造墙阶段恢复。

## 不改动的部分

- `core/scoring|validation|regions|walls|geometry`、关卡数据、坐标系、地图裁剪（上一功能）。
- `chosenVariants` 随机定变体的逻辑。

## 边界 / 错误处理

- 当前卡某选项放置不合法：`placeSelected` 校验失败 → 设 `lastError`，不前进，幽灵保留。
- 越界保护：`currentCardIndex` 达到房间卡数即视为本房间家具阶段结束，不再 +1。
- 改选：选中其一后点另一选项，替换 `selectedOption`（`rotation/mirrored` 归零，镜像不退还万能牌——若已用且当前为镜像态则保持已用状态）。
- 左右滑动与"点击选中另一选项"区分：滑动位移超过阈值判为旋转，否则判为点击。

## 测试

- 纯逻辑单测（vitest，无 cc 依赖；确认 `gameStore` 不 import `cc`，否则抽出纯函数）：
  - 进房间 → `currentCardIndex=0, roomPhase='furniture'`。
  - `placeSelected` 合法 → 当前卡入 placed、index+1。
  - `skipCard` → 当前卡入 skipped、index+1。
  - 最后一张卡 resolved → `roomPhase='construction'`。
  - 家具阶段调 `toggleWall` 等无效（被拦截）。
- 手动冒烟（Cocos 预览，重开 `scene.scene`）：选房间→逐张二选一→左右滑旋转→拖幽灵→确定/跳过→末张后墙/门按钮点亮→可封墙进下一房间。

## 验收标准

1. 进房间后底部只显示当前卡的 2 个选项；点其一选中、点另一改选。
2. 选中项左右滑动可旋转 90°；镜像按钮可用一次后置灰。
3. 户型图上只能滑动移位；点边线在家具阶段无效。
4. "确定"放置、"跳过"进下一张；按顺序推进不可回退。
5. 本房间末张处理后，墙/门/窗/大门按钮自动点亮，可封墙进下一房间。
6. `core/*` 原有测试 + 新增 gameStore 逻辑测试全绿。
