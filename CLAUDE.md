# 项目规范（Claude Code 行为指南）

## Git
- **每完成一个独立改动立即 commit + push to main**，不要跨多步堆积后再一次性提交。
- 不需要用户提醒，这是默认行为。直接在 main 上工作并推送。
- Commit message 用中文或英文均可，简明描述做了什么。

## 语言
- 与用户全程使用**中文**交流。

## 工具服务（本地开发）
- 标注工具：`http://localhost:8777/tools/sprite-annotator/index.html`（支持多 sprite sheet，顶部图集下拉框切换）
- 拼装工具：`http://localhost:8777/tools/assembler/index.html`
- 关卡编辑器：`http://localhost:8777/tools/level-editor/index.html`（编辑/新建关卡，保存到 `md/scenarios/<id>.json` 并自动重建 maps_data）
- 静态服务器：`python tools/server.py`（替代 `python -m http.server`，增加 `/api/crop`、`/api/sheets`、`/api/scenarios`、`/api/scenario` 接口）
- 游戏网页：`http://localhost:8778/`（由 `cd app && npx vite --port 8778` 提供）

## 关卡数据（源 → 成品）
- **源**：`md/scenarios/<id>.json`（每关一个）+ `md/scenarios/_index.json`（顺序）。新建关卡 = 加一个同构 JSON。
- **成品**：`npm run scenarios:build`（在 cocos 目录）把 per-level JSON 打包成 `md/maps_data.yaml` 再生成 cocos 的 `maps_data.json`。`md/maps_data.yaml` 现为生成物，勿手改。
- cocos 与 app 仍读 `md/maps_data.yaml`（加载代码未变）。

## Cocos 资产操作规范
- **移动/重命名资产必须在 Cocos 编辑器内操作**，不能直接 mv 文件，否则 .meta/UUID 会断裂。
- **程序生成的 PNG 放进 resources 必须同时写 `.meta` 并设 `trimType: "none"`**，否则 Cocos auto-trim 会拉伸有透明行的图片（`demo_patch.py` 的 `write_sprite_meta()` 已封装）。
- **修改 JSON 资产文件后，等编辑器底部编译进度完成再运行预览**，编译期间 UI 消失不是 bug。
- **调试游戏逻辑用 Cocos 编辑器 Console**，不用浏览器 DevTools（localhost:7456 是编辑器 UI，`window.gameStore` 在 preview 上下文里）。

## 规则优先级
- `md/RULES.zh.md` 是权威规则来源，与代码冲突时以文档为准。
