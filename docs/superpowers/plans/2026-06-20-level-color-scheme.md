# 关卡配色方案 + 格子线加粗 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让所有关卡的格子线更粗更清晰，并允许在关卡编辑器里为每关单独设置背景色和格子线颜色（RGB），Cocos 与编辑器预览一致。

**Architecture:** 关卡 JSON 新增可选 `theme: { bg?: [r,g,b], gridline?: [r,g,b] }` 字段，build 管线自动透传。Cocos `LayerRenderer.drawGridBg` 读 theme 渲染（无则回退默认常量），并全局加粗格子线。编辑器 `model.js` 解析/写回 theme，`index.html` 提供取色器 + `r,g,b` 文本框，canvas 预览镜像 Cocos 的"底色 + 半透明叠层"渲染模型。

**Tech Stack:** Cocos Creator (TypeScript, `cc` 的 `Graphics`/`Color`)、原生 Canvas 2D（编辑器）、plain ESM JS（`model.js`）、Vitest。

---

## File Structure

- `tools/level-editor/model.js` — 关卡 ↔ model 转换。新增 theme 解析/写回。**可单元测试**。
- `cocos/home-staging-cocos/tests/levelEditorModel.test.ts` — model.js 的 vitest 测试，追加 theme round-trip 用例。
- `cocos/home-staging-cocos/assets/scripts/core/types.ts` — `Scenario` 接口加 `theme?`。
- `cocos/home-staging-cocos/assets/scripts/ui/LayerRenderer.ts` — `drawGridBg` 读 theme + 全局加粗格子线。**渲染，手动验证**。
- `tools/level-editor/index.html` — 配色 UI + canvas 预览镜像 Cocos。**渲染，手动验证**。

测试策略：theme 的数据 round-trip 用 Vitest（Task 1，TDD）。渲染（Cocos `Graphics`、编辑器 canvas）无法单元测试，按项目惯例用 Cocos 预览 / 浏览器手动验证（Task 2、3）。

---

## Task 1: 编辑器 model.js — theme 解析/写回（TDD）

**Files:**
- Modify: `tools/level-editor/model.js`（`emptyModel` ~line 95、`parseScenario` ~line 116、`buildScenario` ~line 180）
- Test: `cocos/home-staging-cocos/tests/levelEditorModel.test.ts`

- [ ] **Step 1: 写失败测试**

在 `cocos/home-staging-cocos/tests/levelEditorModel.test.ts` 的 `describe('level-editor model', ...)` 块内追加：

```ts
it('theme round-trips build→parse→build', () => {
  const m = emptyModel(4, 4);
  m.theme = { bg: [10, 20, 30], gridline: [200, 210, 220] };
  const b = buildScenario(m);
  expect(b.theme).toEqual({ bg: [10, 20, 30], gridline: [200, 210, 220] });
  expect(parseScenario(b).theme).toEqual({ bg: [10, 20, 30], gridline: [200, 210, 220] });
});

it('omits theme entirely when unset', () => {
  const b = buildScenario(emptyModel(4, 4));
  expect('theme' in b).toBe(false);
});

it('partial theme (only bg) keeps bg, omits gridline', () => {
  const m = emptyModel(4, 4);
  m.theme = { bg: [1, 2, 3], gridline: null };
  const b = buildScenario(m);
  expect(b.theme).toEqual({ bg: [1, 2, 3] });
  expect(parseScenario(b).theme).toEqual({ bg: [1, 2, 3], gridline: null });
});

it('ignores malformed theme rgb (wrong length / non-number)', () => {
  const m = emptyModel(4, 4);
  m.theme = { bg: [1, 2], gridline: ['x', 0, 0] };
  const b = buildScenario(m);
  expect('theme' in b).toBe(false);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd cocos/home-staging-cocos && npx vitest run tests/levelEditorModel.test.ts`
Expected: 4 个新用例 FAIL（`b.theme` 为 undefined / `parseScenario(b).theme` 为 undefined）。

- [ ] **Step 3: 在 model.js 实现**

在 `model.js` 顶部（其他 helper 附近）加 RGB 校验 helper：

```js
// An RGB triple is [r,g,b] of three finite numbers; anything else → null (use default theme).
function rgbOrNull(v) {
  return Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(n))
    ? [v[0], v[1], v[2]] : null;
}
```

`emptyModel` 的 return 对象里加一行（在 `bonus_points: [],` 之后）：

```js
    theme: { bg: null, gridline: null },
```

`parseScenario` 的 return 对象里加一行（在 `bonus_points: (...)` 之后、`_raw:` 之前）：

```js
    theme: { bg: rgbOrNull(s.theme?.bg), gridline: rgbOrNull(s.theme?.gridline) },
```

`buildScenario`：把结尾的 `return { ...m._raw, ... };` 改为先建 `out` 再处理 theme。即把

```js
  return {
    ...m._raw,
    id: m.meta.id,
```

改成

```js
  const out = {
    ...m._raw,
    id: m.meta.id,
```

并在该对象字面量结束的 `};` 之后、函数结束前加上：

```js
  const bg = rgbOrNull(m.theme?.bg), gl = rgbOrNull(m.theme?.gridline);
  if (bg || gl) {
    out.theme = {};
    if (bg) out.theme.bg = bg;
    if (gl) out.theme.gridline = gl;
  } else {
    delete out.theme;  // keep old scenarios clean; also overrides any stale _raw.theme
  }
  return out;
```

（注意：原来直接 `return { ... }`，现改为 `const out = { ... }` + theme 逻辑 + `return out;`。）

- [ ] **Step 4: 跑测试确认通过**

Run: `cd cocos/home-staging-cocos && npx vitest run tests/levelEditorModel.test.ts`
Expected: 全部 PASS（含原有 round-trip / idempotent 用例——真实关卡无 theme，`delete out.theme` 保证不新增字段）。

- [ ] **Step 5: 提交**

```bash
git add tools/level-editor/model.js cocos/home-staging-cocos/tests/levelEditorModel.test.ts
git commit -m "feat(level-editor): model 支持每关 theme(bg/gridline) 解析与写回"
```

---

## Task 2: Cocos 渲染 — 全局加粗格子线 + 读取每关 theme

**Files:**
- Modify: `cocos/home-staging-cocos/assets/scripts/core/types.ts`（`Scenario` 接口，~line 162-177）
- Modify: `cocos/home-staging-cocos/assets/scripts/ui/LayerRenderer.ts`（常量 ~line 19、`drawGridBg` ~line 55-105）

- [ ] **Step 1: types.ts 加 theme 字段**

在 `types.ts` 的 `export interface Scenario {` 之前加：

```ts
export interface ScenarioTheme {
  bg?: [number, number, number];
  gridline?: [number, number, number];
}
```

在 `Scenario` 接口里 `stats?: Record<string, unknown>;` 之前加一行：

```ts
  theme?: ScenarioTheme;
```

- [ ] **Step 2: LayerRenderer 默认格子线加粗 + theme helper**

`LayerRenderer.ts` 第 19 行常量改为更明显（alpha 46→100 ≈40%）：

```ts
const COL_GRIDLINE = new Color(255, 255, 255, 100);  // white pencil, bolder for readability
```

在 `drawGridBg` 函数之前加 helper：

```ts
/** Build a Color from a scenario theme RGB triple, or fall back to a default. */
function themeColor(rgb: [number, number, number] | undefined, fallback: Color): Color {
  return Array.isArray(rgb) && rgb.length === 3
    ? new Color(rgb[0], rgb[1], rgb[2], fallback.a)
    : fallback;
}
```

- [ ] **Step 3: drawGridBg 用 theme 取色 + lineWidth 2**

在 `drawGridBg` 内、`const ascii = ...` 之后加：

```ts
  const theme = scenario.theme;
  const bgColor = themeColor(theme?.bg, COL_BG);
  const gridColor = themeColor(theme?.gridline, COL_GRIDLINE);
```

把第 71 行 `g.fillColor = COL_BG;` 改为：

```ts
  g.fillColor = bgColor;
```

把第 93-94 行的格子线设置：

```ts
  g.strokeColor = COL_GRIDLINE;
  g.lineWidth = 1;
```

改为：

```ts
  g.strokeColor = gridColor;
  g.lineWidth = 2;
```

（室内格的半透明白叠层、室外暗叠层、室内白边框均不动——bg 改变时整盘自然染上新色调。）

- [ ] **Step 4: 编译并手动验证**

1. 在 Cocos 编辑器里等底部编译进度跑完（改了 .ts，编译期 UI 消失正常）。
2. 临时给 `md/scenarios/test_0.json` 加一段 theme（验证后撤销）：在 `"grid"` 同级加
   `"theme": { "bg": [40, 20, 60], "gridline": [255, 220, 120] }`
3. `cd cocos/home-staging-cocos && npm run scenarios:build`，等编辑器重新编译资源。
4. 打开 scene.scene、点 Preview，进 `test_0`：背景应偏紫、格子线偏金且明显比之前粗。
   再进一个没加 theme 的关（如 `training`）：背景仍是默认藏青，但格子线同样更粗。
5. 撤销 test_0 的临时 theme：`git checkout md/scenarios/test_0.json md/maps_data.yaml`，
   再 `npm run scenarios:build` 复原成品（或保持 test_0 不变后重 build）。

Expected: 自定义关配色生效；默认关只变粗不变色。

- [ ] **Step 5: 跑一遍核心测试确保没破坏数据加载**

Run: `cd cocos/home-staging-cocos && npx vitest run tests/scenariosRoundtrip.test.ts tests/dataLoaderNormalize.test.ts`
Expected: PASS（theme 是新增可选字段，不应影响既有 round-trip）。

- [ ] **Step 6: 提交**

```bash
git add cocos/home-staging-cocos/assets/scripts/core/types.ts cocos/home-staging-cocos/assets/scripts/ui/LayerRenderer.ts
git commit -m "feat(game): 格子线加粗(lineWidth 2/alpha 100) + drawGridBg 读每关 theme(bg/gridline)"
```

---

## Task 3: 关卡编辑器 — 配色 UI + 预览镜像 Cocos

**Files:**
- Modify: `tools/level-editor/index.html`（HTML 配色区块 ~line 114 后、boot 内事件绑定 ~line 264、`refreshAll` ~line 331、`render` 的 terrain/grid 段 ~line 408-419）

- [ ] **Step 1: 加配色 HTML 区块**

在「规则」`<div class="sec">…</div>`（~line 106-114）之后、「房间」区块之前插入：

```html
      <div class="sec">
        <h3>配色（留空＝默认主题）</h3>
        <div class="row"><label class="k">背景</label><input type="color" id="t-bg-pick" /><input type="text" id="t-bg-rgb" placeholder="r,g,b" style="width:96px" /></div>
        <div class="row"><label class="k">格子线</label><input type="color" id="t-gl-pick" /><input type="text" id="t-gl-rgb" placeholder="r,g,b" style="width:96px" /></div>
        <div class="row"><button id="t-reset">重置为默认</button></div>
      </div>
```

- [ ] **Step 2: 加颜色转换 helper**

在 `<script>` 内、靠近其他常量（如 `TERRAIN_COLOR` 定义附近）加：

```js
const rgbToHex = ([r, g, b]) => '#' + [r, g, b].map((n) => Math.max(0, Math.min(255, n | 0)).toString(16).padStart(2, '0')).join('');
const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const parseRgbText = (s) => { const p = s.split(',').map((x) => parseInt(x.trim(), 10)); return p.length === 3 && p.every((n) => Number.isFinite(n) && n >= 0 && n <= 255) ? p : null; };
// terrain overlays mirror Cocos fillColorFor(): indoor/outdoor are translucent washes over the bg.
const TERRAIN_OVERLAY = { indoor: 'rgba(255,255,255,0.18)', outdoor: 'rgba(0,0,0,0.28)', water: 'rgb(150,180,220)', road: 'rgb(180,180,180)', obstacle: 'rgb(100,100,100)' };
```

- [ ] **Step 3: 绑定取色器 + 文本框 + 重置**

在 `boot()` 内、其他 `bind(...)` / `addEventListener` 绑定附近加：

```js
  function bindColor(key, pickId, rgbId) {
    const pick = $(pickId), txt = $(rgbId);
    pick.addEventListener('input', () => {
      const rgb = hexToRgb(pick.value);
      model.theme[key] = rgb; txt.value = rgb.join(','); txt.style.borderColor = '';
      persist(); render();
    });
    txt.addEventListener('input', () => {
      const t = txt.value.trim();
      if (!t) { model.theme[key] = null; txt.style.borderColor = ''; persist(); render(); return; }
      const rgb = parseRgbText(t);
      if (rgb) { model.theme[key] = rgb; pick.value = rgbToHex(rgb); txt.style.borderColor = ''; persist(); render(); }
      else { txt.style.borderColor = 'var(--bad)'; }   // invalid: show error, don't commit
    });
  }
  bindColor('bg', 't-bg-pick', 't-bg-rgb');
  bindColor('gridline', 't-gl-pick', 't-gl-rgb');
  $('t-reset').onclick = () => { model.theme = { bg: null, gridline: null }; syncThemeInputs(); persist(); render(); };
```

- [ ] **Step 4: refreshAll 同步配色输入（含旧 localStorage 兜底）**

加一个函数（放在 `refreshAll` 附近）：

```js
function syncThemeInputs() {
  if (!model.theme) model.theme = { bg: null, gridline: null };   // older saved models
  const t = model.theme;
  $('t-bg-rgb').value = t.bg ? t.bg.join(',') : ''; if (t.bg) $('t-bg-pick').value = rgbToHex(t.bg);
  $('t-gl-rgb').value = t.gridline ? t.gridline.join(',') : ''; if (t.gridline) $('t-gl-pick').value = rgbToHex(t.gridline);
}
```

在 `refreshAll()` 结尾那行调用链里加上 `syncThemeInputs();`，例如把
`syncToolButtons(); renderRooms(); renderBonuses(); refreshFdInfo(); refreshValidation();`
改为
`syncToolButtons(); renderRooms(); renderBonuses(); refreshFdInfo(); syncThemeInputs(); refreshValidation();`

- [ ] **Step 5: render() 镜像 Cocos 的 bg 底色 + 叠层 + 加粗格子线**

把 `render()` 里 `// terrain` 段（~line 408-414）：

```js
  // terrain
  for (let r=0;r<model.rows;r++) for (let c=0;c<model.cols;c++) {
    ctx.fillStyle=TERRAIN_COLOR[model.terrain[r][c]]||'#000';
    ctx.fillRect(w2sX(c),w2sY(r),cell,cell);
    const f=model.feature[r][c];
    if (f){ ctx.fillStyle='#ffd27f'; ctx.font=`${Math.max(8,cell*0.3)}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(f[0].toUpperCase(), w2sX(c)+cell/2, w2sY(r)+cell/2); }
  }
```

替换为（底色用 theme.bg 铺满，再逐格叠半透明层，与 Cocos 一致）：

```js
  // terrain — mirror Cocos: bg base + translucent washes
  const bg = model.theme?.bg ? `rgb(${model.theme.bg.join(',')})` : 'rgb(16,42,71)';
  ctx.fillStyle = bg; ctx.fillRect(w2sX(0), w2sY(0), cell*model.cols, cell*model.rows);
  for (let r=0;r<model.rows;r++) for (let c=0;c<model.cols;c++) {
    ctx.fillStyle = TERRAIN_OVERLAY[model.terrain[r][c]] || TERRAIN_OVERLAY.outdoor;
    ctx.fillRect(w2sX(c),w2sY(r),cell,cell);
    const f=model.feature[r][c];
    if (f){ ctx.fillStyle='#ffd27f'; ctx.font=`${Math.max(8,cell*0.3)}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(f[0].toUpperCase(), w2sX(c)+cell/2, w2sY(r)+cell/2); }
  }
```

把 `// grid` 段（~line 416）：

```js
  ctx.strokeStyle='rgba(160,180,220,.25)'; ctx.lineWidth=1; ctx.beginPath();
```

替换为（theme.gridline 颜色，alpha 0.4≈cocos 的 100/255，lineWidth 2）：

```js
  ctx.strokeStyle = model.theme?.gridline ? `rgba(${model.theme.gridline.join(',')},0.4)` : 'rgba(255,255,255,0.4)'; ctx.lineWidth=2; ctx.beginPath();
```

- [ ] **Step 6: 手动验证（浏览器）**

1. 起服务：`python tools/server.py`，开 `http://localhost:8777/tools/level-editor/index.html`。
2. 新建/选一关：在「配色」里
   - 背景文本框输入 `40,20,60` → 画布背景立刻变紫；取色器同步显示该色。
   - 用格子线取色器选一个亮黄 → 文本框同步成 `r,g,b`；格子线变色且明显更粗。
   - 文本框输入非法值如 `300,0`（或 `abc`）→ 边框变红、不应用。
   - 点「重置为默认」→ 背景回藏青、格子线回白，文本框清空。
3. 点保存（写 `md/scenarios/<id>.json`），确认文件里出现 `"theme": {...}`；清空配色再保存，确认 `theme` 字段消失。
4. 刷新页面重选该关 → 配色输入正确回填。

Expected: 编辑器预览与 Task 2 的 Cocos 渲染观感一致；非法输入不污染数据；留空＝无 theme 字段。

- [ ] **Step 7: 提交**

```bash
git add tools/level-editor/index.html
git commit -m "feat(level-editor): 配色 UI(背景/格子线 RGB) + 预览镜像 Cocos 渲染"
```

---

## Self-Review

**Spec coverage:**
- 需求 #1 所有关卡格子线加粗 → Task 2 Step 2-3（COL_GRIDLINE alpha 46→100、lineWidth 1→2，对无 theme 的关卡也生效）+ Task 3 Step 5（编辑器同步加粗）。✓
- 需求 #2 编辑器配色（背景+格子线，RGB 输入，每关独立）→ Task 1（数据 round-trip）+ Task 2 Step 1-3（Cocos 读取）+ Task 3（UI + 预览）。✓
- 可选字段、老关回退默认 → Task 1 `delete out.theme`、Task 2 `themeColor` 回退、Task 3 留空＝无字段。✓
- build 透传无需改脚本 → 已在 spec 确认，计划无 build 脚本改动。✓

**Placeholder scan:** 无 TBD/TODO；每个代码步骤都有完整代码与确切命令。✓

**Type consistency:** `theme.bg`/`theme.gridline` 为 `[r,g,b]` 贯穿三处；`rgbOrNull`(model.js) 与 `themeColor`(LayerRenderer) 与 `parseRgbText`(editor) 命名各自独立、用途清晰；`ScenarioTheme` 接口与 JSON 字段一致；alpha 约定统一（Cocos 100/255 ≈ editor 0.4）。✓
