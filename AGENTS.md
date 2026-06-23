# 项目规范(AI 助手行为指南)

> 本文件是本项目所有 AI 助手(Claude Code 等)的**唯一规范来源**。
> `CLAUDE.md` 只是指向本文件的指针。

## 语言

- 与用户全程使用**中文**交流。
- Commit message 用中文或英文均可,简明描述做了什么。

## Git:每完成一个阶段就 commit + push

不要靠"我觉得这算不算一个阶段"来判断——这种判断在小改动和续作上会失灵。改用下面的**硬触发点**。

### 强制 `git status` 检查点

遇到以下情形,先 `git status`;只要工作树里有你做的、已追踪的改动,就**先 commit + push 再做别的**:

1. **用户确认语**:`OK` / `好` / `没问题` / `确认了` / `looks good` / `nice` 等——这些是用户发出的阶段结束信号。
2. **任务标记完成**(TaskUpdate status: completed):标记完成 = 该 diff 可发布。同一轮里立即提交。
3. **回答新的无关问题前**:用户切换话题而你有未提交代码 → 先 push,再回答。
4. **委派长任务前**:交给 Agent/Explore 之前别留脏状态。

默认行为,不需要用户提醒,直接在 `main` 上工作并推送。

### 即便"琐碎"也要提交

用户刚验证过的 2 行 CSS 改动是一个阶段。删一个调试脚本是一个阶段。多一个小 commit 的成本(5 秒)远低于日后一团乱 diff 的成本。

### 仅在以下情况跳过自动提交

- 半成品、且你已在对话里明确标注了 TODO
- 这一轮就要删掉的探索性脚本
- 用户已指出有错、但你还没回退的改动
- 工作树是干净的(`git status` 无 diff)——空操作,跳过

### 每次提交的 workflow

1. `git status` 确认范围
2. 用**显式路径**暂存(不要 `git add .` 或 `-A`)——避免带进垃圾文件和误改的无关路径(用户明确要求批量提交时除外)
3. 范围不清时 `git diff --cached --stat`
4. 提交:标题 < 70 字符,正文用 1-3 段短文说明*为什么*,结尾加
   `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
5. `git push origin main`——未经明确要求绝不 `--force`
6. 报告 commit hash + 一行摘要

### 自审

用户若问"你提交了吗?",老实跑 `git log --oneline -3` **和** `git status` 再回答。没查证前别说"提交了"。

## 工具服务(本地开发)

- 标注工具:`http://localhost:8777/tools/sprite-annotator/index.html`(支持多 sprite sheet,顶部图集下拉框切换)
- 拼装工具:`http://localhost:8777/tools/assembler/index.html`
- 关卡编辑器:`http://localhost:8777/tools/level-editor/index.html`(编辑/新建关卡,保存到 `md/scenarios/<id>.json` 并自动重建 maps_data)
- 静态服务器:`python tools/server.py`(替代 `python -m http.server`,增加 `/api/crop`、`/api/sheets`、`/api/scenarios`、`/api/scenario` 接口)
- 游戏网页:`http://localhost:8778/`(由 `cd app && npx vite --port 8778` 提供)

## 关卡数据(源 → 成品)

- **源**:`md/scenarios/<id>.json`(每关一个)+ `md/scenarios/_index.json`(顺序)。新建关卡 = 加一个同构 JSON。
- **成品**:`npm run scenarios:build`(在 cocos 目录)把 per-level JSON 打包成 `md/maps_data.yaml` 再生成 cocos 的 `maps_data.json`。`md/maps_data.yaml` 现为生成物,勿手改。
- cocos 与 app 仍读 `md/maps_data.yaml`(加载代码未变)。
- 改了**自定义家具**(`asset/furniture_collection.json`)后,`scenarios:build` 不够——还要在 cocos 目录跑 `npm run furniture:library`(重建家具库)+ `npm run sync:tiles`(同步 tile 并写 `trimType:none` meta)。详见 `memory/project_furniture_build_pipeline.md`。

## 多 worktree 并行开发与 Cocos 预览

- Cocos 只从**主仓**(它打开的那个 checkout)读取;worktree(detached、按槽位命名)的改动它看不到。
- 聚合生成物(`md/maps_data.yaml`、`asset/cards_furniture.json`、cocos `resources/data` 下的
  `maps_data.json` / `furniture_library.json`)已**移出 git**,只提交源、预览前 build。
- 预览某 worktree 的内容:worktree 里 `git push origin HEAD:feat/<名>` → 主仓
  `.\tools\preview-ref.ps1 feat/<名>`(fetch + `checkout --detach` + 重建)→ Cocos Reimport。
- 完整流程见 **[docs/worktree-preview.md](./docs/worktree-preview.md)**。

## Cocos 资产操作规范

- **移动/重命名资产必须在 Cocos 编辑器内操作**,不能直接 mv 文件,否则 .meta/UUID 会断裂。
- **程序生成的 PNG 放进 resources 必须同时写 `.meta` 并设 `trimType: "none"`**,否则 Cocos auto-trim 会拉伸有透明行的图片(`demo_patch.py` 的 `write_sprite_meta()` 已封装;`sync-tiles.cjs` 已自动处理 tile)。
- **修改 JSON 资产文件后,等编辑器底部编译进度完成再运行预览**,编译期间 UI 消失不是 bug。
- 改了 `.meta` 后要在编辑器里 **Reimport**(右键 `resources/tiles` → Reimport)才生效,光重开 Preview 不行。
- **调试游戏逻辑用 Cocos 编辑器 Console**,不用浏览器 DevTools(localhost:7456 是编辑器 UI,`window.gameStore` 在 preview 上下文里)。

## 规则优先级

- `md/RULES.zh.md` 是权威规则来源,与代码冲突时以文档为准。

## 领域约定

- **坐标**:cells 是 `[row, col]`、0-indexed;印刷坐标是 1-indexed(数据 row N = 印刷 row N+1;数据 col 0 = 印刷 col A)。
- **`bbox`**(`furniture_data.yaml`):是 `shape ∪ open_spaces` 的最小包围矩形;内部可不规则(bbox 内既非 shape 也非 open 的格子是 "void")。
- **`wall_edges`**:作用于该 bbox 边上的**所有非 void 格**(shape 和 open spaces 都算——岛台式家具的开放格也贴墙)。

## 累积的用户偏好

- 见 `memory/feedback_*.md`(review-omission 规则等)。做 review 相关工作前务必先看。
- 会话级注入的 `memory/MEMORY.md` 是记忆索引,跨会话生效。
