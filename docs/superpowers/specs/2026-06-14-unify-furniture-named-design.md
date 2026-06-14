# 家具统一为命名家具 + 房间按名字选家具

日期：2026-06-14。子项目（关卡编辑器后续）。

## 决策（已确认）
- 范围：只改编辑器 + scenario 数据；游戏本体适配以后。
- 命名家具**取代**编号；先把编号卡牌**转换**成命名家具以统一。
- 转换粒度：每张卡(number+variant)的**每个 option** 各一件（66 卡 × 2 = ~132 件）。
- 视觉：试自动按网格从卡图切 100×100（实验性，先原型验证）。
- wall_edges/printed_markers：自定义家具以后在拼装工具补；卡牌转来的本就有，**顺带带上**。

## 现状
- 编号卡牌 `furniture_data.json`（66 卡，每卡 2 option）：option 含 name_zh/bbox/shape/open_spaces/wall_edges/printed_markers——精确现成。
- 自定义命名家具 `asset/furniture_collection.json`（23 件，assembler 产出）：name/bbox/tiles/open_cells。
- 卡图 `md/images/cards/furniture/NN_[AB].jpg`（826×1167 竖版卡照，含 2 个手绘网格示意图 + 标题/文字）。

## 组件

### 1. 卡牌→命名家具数据 `tools/cards-to-furniture.cjs`
读 furniture_data.json，每 option 生成一件：
```
{ name, id, source:"card", number, variant, option_index,
  bbox, shape, open_cells(=open_spaces), wall_edges, printed_markers, name_en }
```
- `id = "<number><variant>_<opt+1>"`（如 `1A_1`，唯一）。
- `name = "<name_zh> <number><variant>-<opt+1>"`（唯一显示名）。
- 输出 `asset/cards_furniture.json`（独立文件，不动 assembler 的 furniture_collection.json）。

### 2. 统一库（编辑器加载时合并）
编辑器 `fetch` 两个文件并合并成统一列表：
- `asset/furniture_collection.json` → source:"custom"，name 即显示名。
- `asset/cards_furniture.json` → source:"card"。
按 name 去重（冲突告警）。

### 3. 房间按名字选家具（编辑器）
- 右栏房间去掉「家具编号」文本框，改为**家具选择器**：下拉列统一库名字（按 source 分组）+「添加」→ 追加到房间的允许家具列表；可重复；每项可删。
- 数据：`room.furniture: string[]`（名字）。

### 4. model.js
- room 模型：`{slot,name_zh,name_en,furniture:string[],_numbers?:number[]}`。
- buildScenario：有 furniture 名字则输出 `furniture`；否则有 `_numbers` 则输出 `furniture_numbers`（保留未触碰的老关卡）。
- validate：房间引用的名字必须在统一库内（校验对名字）。
- types.ts `Room` 加可选 `furniture?: string[]`（与 furniture_numbers 并存，等游戏适配再清理）。

### 5. 图像切片（实验性）`tools/slice-cards.py`
- 每张卡按已知 bbox(R×C) 网格，自动定位两个 option 示意图矩形并等分，shape 格切成 100×100 存入 `asset/tiles/`（命名 `<id>_r<r>c<c>.png` 或并入命名家具 tiles）。
- 先在 2–3 张卡上跑，**肉眼验证**；不行则回退「整图一块」或半人工框选，并如实报告。

## 不做
- 不动游戏本体加载/渲染/抽卡（以后）。
- 不动现有 27 关的 furniture_numbers。
- 不动 assembler 的 furniture_collection.json 写入逻辑。
