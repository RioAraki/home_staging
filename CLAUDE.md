# 项目规范（Claude Code 行为指南）

## Git
- **每完成一个独立改动立即 commit**，不要跨多步堆积后再一次性提交。
- Commit message 用中文或英文均可，简明描述做了什么。

## 语言
- 与用户全程使用**中文**交流。

## 工具服务（本地开发）
- 标注工具：`http://localhost:8777/tools/sprite-annotator/index.html`
- 拼装工具：`http://localhost:8777/tools/assembler/index.html`
- 静态服务器：`python tools/server.py`（替代 `python -m http.server`，增加了 `/api/crop` 接口）
- 游戏网页：`http://localhost:8778/`（由 `cd app && npx vite --port 8778` 提供）

## 规则优先级
- `md/RULES.zh.md` 是权威规则来源，与代码冲突时以文档为准。
