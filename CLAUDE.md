# 项目规范（Claude Code 行为指南）

## Git
- **每完成一个独立改动立即 commit + push to main**，不要跨多步堆积后再一次性提交。
- 不需要用户提醒，这是默认行为。直接在 main 上工作并推送。
- Commit message 用中文或英文均可，简明描述做了什么。

## 语言
- 与用户全程使用**中文**交流。

## 工具服务（本地开发）
- 标注工具：`http://localhost:8777/tools/sprite-annotator/index.html`
- 拼装工具：`http://localhost:8777/tools/assembler/index.html`
- 静态服务器：`python tools/server.py`（替代 `python -m http.server`，增加了 `/api/crop` 接口）
- 游戏网页：`http://localhost:8778/`（由 `cd app && npx vite --port 8778` 提供）

## Cocos 资产操作规范
- **移动/重命名资产必须在 Cocos 编辑器内操作**，不能直接 mv 文件，否则 .meta/UUID 会断裂。
- **程序生成的 PNG 放进 resources 必须同时写 `.meta` 并设 `trimType: "none"`**，否则 Cocos auto-trim 会拉伸有透明行的图片（`demo_patch.py` 的 `write_sprite_meta()` 已封装）。
- **修改 JSON 资产文件后，等编辑器底部编译进度完成再运行预览**，编译期间 UI 消失不是 bug。
- **调试游戏逻辑用 Cocos 编辑器 Console**，不用浏览器 DevTools（localhost:7456 是编辑器 UI，`window.gameStore` 在 preview 上下文里）。

## 规则优先级
- `md/RULES.zh.md` 是权威规则来源，与代码冲突时以文档为准。
