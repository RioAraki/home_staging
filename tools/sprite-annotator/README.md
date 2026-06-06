# Sprite Sheet 标注 / 裁切工具

把 `asset/asset.png` 按 **100×100** 格子逐格打标，导出 JSON，再离线批量裁成单格 PNG（碎片），供你之后自行拼接成与原素材尺寸一致的新美术。

## 1. 标注（网页）

直接用浏览器打开 `index.html`（双击即可，`file://` 下工作）。

- 启动时自动尝试加载 `../../asset/asset.png`；加载失败会弹出拖拽框，把 PNG 拖进去或点击选择。
- **操作**：滚轮缩放 · 按住 `空格` 拖动平移 · 点击格子选中 · 在右侧输入标签按 `Enter` 打标 · 方向键移动选中格 · `Delete` 清除当前格。
- **格子**：默认 100×100，右/下除不尽的边角忽略（`41×20` 格）。可在右上「格子」改尺寸。
- **冲突**：同一标签标到两个格子会标红并在顶部计数，避免误双击。
- 标注实时存 `localStorage`（刷新不丢）；完成后点 **导出 JSON** 得到 `annotations.json`。**导入** 可载回之前的 JSON 继续。

JSON 结构：
```json
{
  "image": "asset.png", "imageSize": [4167, 2084], "cell": 100, "cols": 41, "rows": 20,
  "annotations": [ { "col": 0, "row": 0, "x": 0, "y": 0, "w": 100, "h": 100, "label": "沙发碎片1" } ]
}
```

## 2. 裁切（离线脚本）

```bash
pip install pillow
cd tools/sprite-annotator
python crop.py                  # 用 ./annotations.json + ../../asset/asset.png，输出到 ./out/
# 或：python crop.py <json> <png> <out_dir>
```

每条标注 → 一张 `out/<标签>.png`。重复标签不会丢，会写成 `标签__2.png` 并告警；裁切超出图像处会自动夹到边界。

## 3. 之后

`out/` 里就是带语义命名的 100×100 碎片。你自行把碎片拼成与 `cards/vector/*.png` 尺寸一致的高质量新素材，再替换进游戏（`assets/resources/cards/vector/`）。
