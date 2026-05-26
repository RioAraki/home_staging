# 手工矢量化家具卡片 — 工作流

游戏里每张家具卡的渲染管线现在支持三种方式：

1. **扫描图 + clip**（默认）— 走 `images/cards/options/*.jpg`，自动反色/亮度混合贴到 shape cell 上。
2. **程式化 primitive 组合** — 用 `sofa_run` / `shelf_unit` / `chair_dot` / `table_top` / `plant_potted` 等组件按 cell 拼装。
3. **手工 SVG 粘贴**（本文档） — 你在 Inkscape / Figma / Illustrator / Boxy SVG 里画好，直接把 SVG 标记贴进 yaml。

任何一张卡只要在 `md/furniture_visual.yaml` 加了对应 `entries` 项，floor plan 和 review 页就立刻走 vector 路径；没条目就退回扫描图。

---

## Quick start — 给单张卡画一个手工 SVG

### 1. 查清楚卡的 bbox

打开 `md/furniture_data.yaml`，找到对应卡。例如 `#1A opt1 "长沙发"`：

```yaml
- number: 1
  variant: A
  options:
    - option_index: 1
      name_zh: "长沙发"
      bbox: [1, 4]              # ← rows=1, cols=4
      shape: [[0,0],[0,1],[0,2],[0,3]]
      open_spaces: [[1,0],[1,1],[1,2],[1,3]]
```

`bbox: [1, 4]` 意味着这张卡的画布是 **1 行 × 4 列**。

### 2. 在 SVG 编辑器里画

**坐标约定：1 cell = 100 units**（即每个格子 100×100）。

- 给 #1A opt1 (bbox 1×4)，画布大小设为 **400 × 100** 用户单位。
- 给 #5A opt1 (bbox 2×3)，画布设为 **300 × 200**。
- 以此类推。

画图时建议：
- **描边**：用 `rgba(255,255,255,0.92)`（白色 + 微透）作为主轮廓色，对应 blueprint theme 的 `stroke`。
- **细描边**：用 `rgba(255,255,255,0.55)`（更淡）做次级线条，对应 `detailStroke`。
- **填充**：用 `rgba(255,255,255,0.07)` 做主体淡填充，或 `rgba(0,0,0,0.22)` 做"背板"类暗色叠加。
- **强调点 / accent**：`#ffe169`（琥珀色）用于桌腿点、灯具等亮点。
- **stroke-width**：1.6 ~ 2 之间。primitive 用的是 1.8。

放好坐标后，画家具的"俯视图"（top-down architectural plan view）即可。

### 3. 导出 SVG，复制内部内容

导出 `.svg` 文件，用文本编辑器打开。文件结构大概长这样：

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100" viewBox="0 0 400 100">
  <g stroke="rgba(255,255,255,0.92)" stroke-width="2" fill="none">
    <rect x="10" y="10" width="380" height="60" rx="12"/>
    <line x1="100" y1="10" x2="100" y2="70"/>
    <!-- ... -->
  </g>
</svg>
```

**复制 `<svg>` 和 `</svg>` 之间的所有内容**（最外层 `<g>` 也含进去）。

### 4. 贴进 `furniture_visual.yaml`

在 `entries:` 列表里添加（或替换现有项）：

```yaml
- number: 1
  variant: A
  option_index: 1
  parts:
    - kind: raw_svg
      cells: [[0,0],[0,1],[0,2],[0,3]]   # 这里列出 shape ∪ 你想覆盖的 cell
      paths: |
        <g stroke="rgba(255,255,255,0.92)" stroke-width="2" fill="none">
          <rect x="10" y="10" width="380" height="60" rx="12"/>
          <line x1="100" y1="10" x2="100" y2="70"/>
          ...
        </g>
```

字段说明：
- `kind: raw_svg` — 使用手工 SVG primitive。
- `cells` — 你的 SVG 会被偏移到 `min(cells)` 那个角，并缩放为 `cellSize` 大小。一般直接列上 shape cells 即可。
- `paths` — yaml 多行字符串（`|` 保留换行）。粘贴你导出的内部 SVG 标记。

### 5. 检查渲染

- 跑 `npm run dev`（如果还没跑）。
- 打开浏览器 → `#/review`，找到对应卡。
- 右侧 **OUR RENDER** 应该显示你画的 SVG。
- 也可以在游戏页面摆这张卡看 floor plan 上的实际效果。

如果太大/太小：检查你的画布是否按 **100 units/cell** 缩放。例如 4 列卡画在了 800×200 画布上 → 用 `unitsPerCell: 200` 修正：

```yaml
- kind: raw_svg
  cells: [[0,0],[0,1],[0,2],[0,3]]
  unitsPerCell: 200
  paths: |
    ...
```

---

## 旋转 / 镜像怎么办？

不用你管。家具放到 floor plan 上的旋转和镜像由外层 `<g transform="rotate(...) scale(-1,1)">` 处理，作用于整个手工 SVG。你只画原始（0 度，未镜像）状态即可。

---

## 混用：手工 SVG + 程式化 primitive

`parts:` 是数组，可以混搭。例如卡的主体手画，但椅子复用 `chair_dot`：

```yaml
- number: 5
  variant: A
  option_index: 1
  parts:
    - kind: raw_svg
      cells: [[0,1],[1,1]]
      paths: |
        <g stroke="white" fill="none">...自定义的桌+植物画法...</g>
    - kind: chair_dot
      cells: [[0,0]]
      face: E
    - kind: chair_dot
      cells: [[0,2]]
      face: W
```

---

## 常见坑

- **看不到内容**：检查 `cells` 是否覆盖了你的 SVG 范围。SVG 内容会被裁/平移到 `min(cells)` 的角。
- **画偏了**：你的画布原点不在 (0, 0)。重新画时把 piece 对齐到画布左上角。
- **颜色太透/太亮**：调你的 stroke / fill 颜色 alpha。
- **被旋转后翻了**：raw_svg 内部不要再 transform，让外层来旋转。
- **多张 svg 重叠**：`parts` 按顺序绘制，后一个覆盖前一个。把"上层"的 part 放在数组后面。

---

## 让我画的话需要什么信息

如果你画好了某张卡，告诉我：
- 卡号 + variant + option_index（例如 `#5A opt2`）。
- bbox 是多少（确认一下）。
- 把整段 `paths:` 块发给我或直接贴进 yaml。

我可以帮你 type-check、commit、推上去。
