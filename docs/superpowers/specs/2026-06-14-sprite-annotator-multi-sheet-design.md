# Sprite Annotator 支持多 Sprite Sheet

日期：2026-06-14

## 背景 / 问题

标注工具 (`tools/sprite-annotator/index.html`) 与裁切服务端 (`tools/server.py`) 都硬编码了单一 sprite sheet：

- 客户端：`IMG_DEFAULT='../../asset/asset.png'`、单一 localStorage key `sprite-annotator-v1`、导出写死 `image:'asset.png'`、标注只按 `"col,row"` 存（无 sheet 身份）。
- 服务端：`IMG_PATH`/`ANN_PATH`/`OUT_DIR` 全部写死 `asset/asset.png` / `asset/annotations.json` / `asset/tiles`，**完全忽略客户端传来的 `image` 字段**。

现在有第二批 sprite `asset/asset2.png`，需要能在同一工具里标注并裁切，与 asset.png 并存、互不覆盖。

## 关键事实

- `crop.py` **不清空输出目录**：按 label 写单个 PNG，并从整个目录 glob 重建 `tiles.json`。→ 多个 sheet 裁到同一个 `asset/tiles` 会自然合并成一个 tile 池。
- assembler 读的就是 `asset/tiles/tiles.json` 这个共享池。→ **assembler 无需改动**。
- 前提：label 跨 sheet 不重名（家具名本就唯一；crop.py 另有 `__2` 去重兜底）。

## 设计

### 输出：共享 tile 池
保持 `asset/tiles` 为唯一输出目录，多 sheet 裁切合并。assembler、crop.py 不动。

### 服务端 `server.py`
1. `_handle_crop` 尊重 `image` 字段：取其 basename，解析为 `asset/<basename>`，校验文件存在且位于 `asset/` 内（拒绝目录穿越 / 缺失文件，返回错误）。
2. 每个 sheet 独立标注文件：`asset/<stem>.annotations.json`（如 `asset/asset.annotations.json`、`asset/asset2.annotations.json`），不再共用单一 `annotations.json`。
3. 裁切输出仍为共享 `asset/tiles`。
4. 新增 `GET /api/sheets`：返回 `asset/` 下所有 `*.png` 的文件名数组（供下拉框）。
5. 迁移：把现有 `asset/annotations.json` 重命名为 `asset/asset.annotations.json`，保留 asset.png 已有标注。

### 标注器 `index.html`
1. 顶部新增 **sheet 下拉框**；启动 `fetch('/api/sheets')` 填充，默认选第一个（asset.png 优先）。
2. 维护 `currentSheet`。切换时：先保存当前 sheet 标注 → 载入 `../../asset/<sheet>` → 载入该 sheet 标注。
3. 按 sheet 持久化：localStorage key 改为 `sprite-annotator-v1:<sheet>`。切到某 sheet 若 localStorage 无记录，回退 `fetch('asset/<stem>.annotations.json')` 作为初始标注。
4. 一次性迁移：老 `sprite-annotator-v1` → `sprite-annotator-v1:asset.png`。
5. 导出携带 `image: currentSheet`。
6. 拖拽 / 选文件保留：把 `currentSheet` 设为该文件名（裁切要求文件确实在 `asset/`，否则服务端报错并提示）。

### 数据流
启动 → `/api/sheets` 填下拉 → 选 sheet → 载图 + 载标注 → 标注（按 sheet 存 localStorage）→ 导出（带 image）→ 服务端按 image 裁切到共享 tiles → assembler 读合并后的 tiles.json。

## 错误处理
- `/api/crop` image 缺失或越界 → 500 + 错误信息，客户端已有 fallback（下载 JSON）+ 控制台告警。
- `/api/sheets` 失败 → 下拉框退回仅含默认项；标注器仍可用。

## 不做（YAGNI）
- 不改 assembler、不改 crop.py。
- 不做跨 sheet 重名检测（依赖唯一命名 + crop.py 去重兜底）。
