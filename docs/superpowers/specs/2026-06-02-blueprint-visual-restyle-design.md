# 蓝图视觉风格重构 — 设计文档

- 日期：2026-06-02
- 范围：Cocos 版（`cocos/home-staging-cocos/`）
- 目标：把户型图与家具的观感对齐网页版的"蓝图"风格——海军蓝背景、白色线稿、行列标签、悬停黄格+点。纯视觉层，不动游戏逻辑/坐标/裁剪/交互。

## 参考（网页版实现事实）

- `app/src/vector/themes/blueprint.ts`：bg `#102a47`、线 `rgba(255,255,255,0.92)`、强调 `#ffe169`。
- `furniture_visual.yaml` **为空**（0 schema）→ 网页家具观感 = 卡图 + CSS `filter: invert(1)`（`FloorPlan.css:84`），裁剪到 shape 格，open space 格画点。
- 标签 A–P / 1–16 画在网格外侧留白（`labelGap`）。

结论：**无需移植矢量系统**，把卡图反色即可。

## 设计

### ① 蓝图配色（LayerRenderer 颜色常量改写）
- `COL_BG = #102a47`（outdoor 圈与画布同色）
- `COL_INDOOR = rgba(255,255,255,~0.06)` 半透明白填充
- `COL_GRIDLINE = rgba(255,255,255,0.18)` 细白网格
- `COL_INDOOR_BORDER = rgba(255,255,255,0.95)`，粗 5px
- `COL_ACCENT = #ffe169`（悬停/点）

### ② 地图重绘（`LayerRenderer.drawGridBg`，保持现有裁剪）
- 整个裁剪区铺 `COL_BG`；`terrain==='indoor'` 的格子叠半透明白。
- **室内白边框**：遍历 indoor 格，若某侧邻格非 indoor，则在该边画粗白线 → 精确勾出户型轮廓（支持非矩形）。
- 细白网格线照旧（颜色改白）。

### ③ 行列标签（新增 `FloorPlan` 标签层，用 Label 节点而非 Graphics）
- 列：可见列 `c` → 字母 `String.fromCharCode(65+c)`，画在网格上方留白。
- 行：可见行 `r` → 数字 `r+1`，画在网格左侧留白。
- `viewport.computeLayout` 预留 `LABEL_GAP`（两侧各 ~28px）：`cell = floor(min((availW-2*gap)/cols,(availH-2*gap)/rows))`，使标签有空间且不挤压网格。
- 标签字号随 cell 缩放，斜体白色（近似网页手写体）。

### ④ 悬停反馈（`GhostPiece` 改为画格子，不再贴精灵）
- 拖动时：occupied 格 = 黄色半透明填充 + 黄边；open space 格 = 中心黄点。
- 用 Graphics 绘制（基于 `transformOption` 后的 shape/open_spaces + origin），随拖动/旋转刷新。
- 不合法位置可整体泛红（沿用现有 flashRed 思路，可选）。

### ⑤ 家具线稿渲染（核心）
- **预处理脚本** `md/invert_cards.py`：读 `cocos/.../resources/cards/options/*.jpg`，输出 `cocos/.../resources/cards/vector/<同名>.png`，RGB 置白、`alpha = 255*(1 - 亮度)` → 白线稿透明底。
- `PlacedPiece`：改用 `cards/vector/NN_V_optX` 的 PNG（白线稿叠蓝底）；并在 open space 格中心画白/灰点（Graphics）。保留已实现的真实旋转/镜像。
- `RoomPanel` 缩略图：选项背景改深蓝、图改用同 PNG，风格统一；标题/按钮不变。

## 不改动
- `core/*`、gameStore 逻辑、坐标系、地图裁剪、交互流程（二选一/旋转/放置/跳过/阶段门控）。
- 已放置判定、计分。

## 边界 / 错误处理
- 某卡缺 PNG：回退到原 jpg（渲染不致崩）。
- 非矩形 indoor：白边框按逐边邻接判定，天然正确。
- 标签过多/cell 过小：字号下限保护，必要时隔一格标注（先全标，过密再说）。

## 测试
- 既有 vitest（geometry/viewport/roomFlow/hitTest）继续全绿——逻辑未动。
- `viewport.computeLayout` 增加 LABEL_GAP 后，更新相关单测的 cell 期望值。
- 预处理脚本：抽查 1–2 张输出 PNG 目视确认（白线稿透明底）。
- 手动冒烟（Cocos 预览，重开 scene）：蓝底、白框户型、行列标签正确、拖动黄格+点、放置后白线稿+open 点。

## 验收标准
1. 户型图为海军蓝底 + 半透明白室内 + 粗白边框。
2. 网格外侧有正确的 A–P / 1–16 标签（裁剪范围内真实坐标）。
3. 拖动家具时 occupied 格标黄、open space 格中心有点。
4. 已放置家具显示为白色线稿（反色卡图）+ open space 点，旋转/镜像正确。
5. 底部二选一缩略图风格与之统一。
6. `core/*` 测试全绿。
