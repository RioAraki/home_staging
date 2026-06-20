# 关卡配色方案 + 格子线加粗 设计

日期：2026-06-20

## 背景与目标

用户已能用关卡编辑器制作自定义关卡。在此基础上提出两点：

1. **所有关卡的格子分界线加粗**，更易分辨格子。
2. **关卡编辑器提供配色选项**，可改背景色与格子线颜色（用户提供 RGB 数据），让不同关卡有不同 color scheme，增加新鲜感。

交付端为 **Cocos**（最终打包微信小游戏）。React/SVG app 是纯技术验证，本次不动。关卡编辑器预览需与 Cocos 渲染保持一致。

## 数据格式

每关 `md/scenarios/<id>.json` 新增一个**可选** `theme` 字段，RGB 数组形式：

```json
"theme": {
  "bg":       [16, 42, 71],
  "gridline": [255, 255, 255]
}
```

- **可选**：未设置时回退到默认主题。现有 28 个关卡不写 `theme`，无需逐个改。
- 仅这两项颜色（背景、格子线）。墙线/门窗/室内填充等不开放配置。
- build 管线（`scenarios-bundle.cjs` → `yaml2json.cjs`）直接 `JSON.parse` 整个关卡对象再 dump，新字段自动透传到 `maps_data.yaml` / `maps_data.json`，**无需改 build 脚本**。

## 改动点 1 —— 格子线加粗（全局，所有关卡）

文件：`cocos/home-staging-cocos/assets/scripts/ui/LayerRenderer.ts`

- 格子线 `lineWidth: 1 → 2`。
- 默认格子线颜色透明度从 `alpha 46`（≈18%）提到 `alpha ≈ 100`（≈40%）。
- 这是常量调整，对未设 `theme` 的关卡同样生效，满足"所有关卡"要求。
- 编辑器 canvas（`tools/level-editor/index.html` 的 `render()`）同步：格子线 `lineWidth 1 → 2`，颜色透明度对齐。

## 改动点 2 —— 每关配色

### Cocos 渲染（`LayerRenderer.ts` `drawGridBg`）

`drawGridBg(g, scenario, frontDoorEdge)` 已能拿到 `scenario`。新增读取：

- `theme.bg` 存在 → 用它构造 `Color` 替换底色常量 `COL_BG`（整块画布底色）。室内格仍是半透明白叠在底色之上，因此整盘会染上该色调，配色感自然呈现。
- `theme.gridline` 存在 → 用它构造格子线颜色（套用上面统一的 alpha≈100），否则回退默认白。
- 取色封装成一个小 helper（如 `themeColor(arr, fallback, alpha)`），避免散落判空逻辑。

### 关卡编辑器

文件：`tools/level-editor/model.js`

- `parseScenario`：读入 `s.theme`，存进 model（如 `model.theme = { bg: [...]|null, gridline: [...]|null }`）。
- `buildScenario`：把 `model.theme` 写回输出对象；两项都未设时**省略** `theme` 字段（保持老关 JSON 干净）。
- 因 `buildScenario` 以 `..._raw` 起手，未显式处理也会被透传——但本次显式管理以支持编辑。

文件：`tools/level-editor/index.html`

- 侧栏新增「配色」区块，两组输入：**背景**、**格子线**。
- 每组提供：原生取色器 `<input type=color>` + 一个 `r,g,b` 文本框（可直接粘贴 RGB 数字），两者双向同步。
- 一个「重置为默认」按钮，清空 theme（恢复默认主题）。
- canvas `render()` 用 model.theme 取色 + 加粗线宽，做到**预览所见即 Cocos 所得**。改动后调用 `persist()` 保存。

## 不做（YAGNI）

- 不改 app(React) 端。
- 不开放墙线/室内填充/门窗等其他颜色配置。
- 线宽不做成每关可调（需求 #1 是统一加粗）。
- 不批量给老关刷配色——只做机制，用户后续在编辑器逐关手动调。

## 验证

- 编辑一关设置 theme → 保存 → `npm run scenarios:build` → 在 Cocos 预览确认背景/格子线颜色与编辑器一致。
- 不设 theme 的老关 → 确认仍是默认主题且格子线已加粗。
- 检查 `theme` 字段正确写入 `md/scenarios/<id>.json` 且 build 后出现在 `maps_data`。
