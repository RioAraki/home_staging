# 关卡编辑器（子项目 2）

日期：2026-06-14。依赖子项目 1（per-level JSON 源 + bundle）已完成。

## 形态
独立工具 `tools/level-editor/index.html`（vanilla HTML/CSS/JS + canvas），由 `tools/server.py`（:8777）提供。纯函数抽到 `tools/level-editor/model.js`（ESM，可单测）。

## 关键认知
Scenario 里 **rooms 没有空间位置**（只有 slot/名字/furniture_numbers）——房间区域是玩家游戏中画墙才产生的。所以画布只画：**网格地形 + 预绘门/窗/内墙/marker + front_door 强制格**。rooms / furniture / rules / bonus / meta 都是右侧面板的纯数据，不落在格子上。这让画布大幅简化。

## 画布模型
- `rows×cols`（默认 16×16，可改）。
- `terrain[r][c]`：`indoor|outdoor|water|obstacle|road`。
- `feature[r][c]`：可选 `tree|column|low_ceiling|lake|wall_pillar|charred|...`。
- 边集合（edge key `h:r:c` / `v:r:c`）：`doors`、`windows`、`walls_interior`。
- `markers`：`{cell:[r,c], id, symbol?}`。
- front_door：`forced_cells` / `forced_edges`（可视化 + 编辑）。

## 工具（左栏）
地形刷子（5 种）、特征刷子、门/窗/内墙（点格子边切换）、marker（点格子）、front-door 强制格刷子。左键画/放、右键擦、空格拖动、滚轮缩放（沿用其它工具交互）。

## 面板（右栏）
- **元信息**：id、title_zh/en、chapter_zh、difficulty、pages_in_book、page_image。
- **房间**：增删房间（slot I–V、中英文名）、每房间的 furniture_numbers（从 furniture_data 选，显示 name_zh）。
- **规则**：hallway.required 开关；front_door（on_exterior_wall_anywhere / forced_edges / forced_cells / width）；drawing rules（常见模板：no_furniture_on_carpet、window_area_no_cover〔带 cells〕等）。
- **奖励**：bonus_points 列表（text_zh/en + points）；condition MVP 用原始 JSON 文本框（结构化编辑留 Phase 2）。
- **校验**：实时问题列表。

## 导出 / 导入
- **导出 Scenario**：装配成与现有同构的对象——`grid.ascii`+`legend` 由 terrain/feature 动态生成（编辑器自定义 glyph，legend 只含用到的类型）；`pre_drawn{doors,windows,walls_interior,markers}`；`rules{hallway,front_door,drawing,scoring:[]}`；`zones:{}`；`bonus_points`；meta。
- **导入**：读 `md/scenarios/<id>.json`，用 legend 反解 terrain/feature，恢复边与面板数据。
- 复杂关卡（含 zones/exotic 字段）导入时未识别字段**原样保留**透传，导出时带回，避免丢数据。

## 服务端（server.py 新增）
- `GET /api/scenarios`：读 `md/scenarios/_index.json` + 各文件 title/difficulty → 列表（给选择器）。
- `POST /api/scenario`：体为 scenario JSON。校验 id（slug）、写 `md/scenarios/<id>.json`、新 id 追加进 `_index.json`，随后跑 `node scenarios-bundle.cjs && node yaml2json.cjs` 使游戏数据更新；返回 ok / 错误。
- 读取走静态服务（root 已是仓库根，可直接 fetch `/md/scenarios/<id>.json`）。

## 校验项
indoor 非空且连通（警告）；房间 furniture_numbers 存在于 furniture_data；预绘门/窗在合法边；bonus condition 引用的 marker.id 存在；front_door forced_cells 在外墙边界；id 唯一且为 slug。

## model.js（纯函数，单测）
`terrainToAsciiLegend(terrain,feature)`、`asciiLegendToTerrain(grid)`、`buildScenario(model)`、`parseScenario(json)→model`、`validate(model,furnitureNumbers)`。
测试：`buildScenario→parseScenario→buildScenario` 幂等（编辑器自建模型 round-trip 稳定）。

## 不做（YAGNI / Phase 2）
bonus condition 结构化 UI、zones 编辑、furniture 缩略图、试玩跳转、撤销树（用 localStorage 自动存 + 简单 undo 栈即可）。
