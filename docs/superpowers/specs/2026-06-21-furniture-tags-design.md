# 家具 Tag(标签)功能设计

日期:2026-06-21
改动文件:`tools/assembler/index.html`(主)、`cocos/home-staging-cocos/tools/furniture-library.cjs`(加一行)

## 目标
让用户在拼装工具里自定义一组标签(如 植物 / 音乐 / 起居室),给每件 **custom 拼装家具**打上任意多个标签。标签将来与奖励系统挂钩(本次不做奖励逻辑)。

## 决策(已与用户确认)
- 范围:**仅 custom 拼装家具**(card 卡牌家具不涉及)。
- 词表:**管理型**(先定义标签,再在家具上点选),非自由文本。
- UI:**扩展现有拼装工具** `tools/assembler/index.html`。

## 数据结构
`asset/furniture_collection.json` 增加:
```json
{
  "tag_vocabulary": ["植物", "音乐", "起居室"],
  "furniture": [
    { "name":"长沙发", "bbox":[2,4], "tiles":[...], "open_cells":[...],
      "tags": ["起居室", "植物"] }
  ]
}
```
- `tag_vocabulary`:顶层全局词表,与数据同住一文件,随导出/导入一起走。
- 每件家具新增 `tags: string[]`(任意多,引用词表里的名字)。
- 合并脚本 `furniture-library.cjs` 给 custom 家具补 `tags: f.tags || []`,使标签随 `furniture_library.json` 进游戏端,供将来奖励系统按 tag 名匹配读取。

## 拼装工具 UI(右侧面板新增「标签」区)
位置:右侧面板,「选中格」与「家具列表」之间。
- **词表 = 一排可点选 chip**:
  - 单击芯片 = 对当前编辑家具切换该 tag(选中=琥珀高亮,未选=灰)。
  - 双击芯片 = 重命名该标签(级联改掉所有家具里的旧名)。
  - 芯片上 `✕` = 从词表删除(确认后,同时从所有家具 tags 里剥掉)。
- **`+ 新标签` 输入框 + 添加按钮**:新标签加入词表(去重、非空)。
- **家具列表项**追加该家具已选 tag 的小灰字,扫一眼可见。

## 编辑模型(沿用现有 buffer 模式)
- 新增状态:`currentTags`(当前画布缓冲的 tag 集,`Set<string>`)、`tagVocab`(词表,`string[]`)。
- `loadFurniture(i)`:把 `collection[i].tags` 载入 `currentTags`。
- `buildFurnitureObj(name)`:写入 `tags:[...currentTags]`(修复"重建对象时丢 tag")。
- 单击 chip 切换 tag:改 `currentTags` + `save()`(写 localStorage);随「保存到列表 / 新建画布」一并 bake 进 collection,与现有 name/cells/openCells 行为一致。
- `save()` / `loadLS()`:持久化 `tagVocab` 与 `currentTags`。
- `导出 JSON`:顶层带 `tag_vocabulary`。`载入`:读回 `d.tag_vocabulary`(缺省空)。

## 边界
- 删除 / 重命名词表标签 → 级联更新所有 collection 家具的 `tags`,保持奖励规则按名匹配一致。
- 不加 server API,沿用现有「导出 → 替换文件 → 跑 build」流程让标签进游戏。
- card 卡牌家具不打 tag。

## 验证
- 新增标签「植物/音乐/起居室」→ 词表显示 3 个芯片。
- 载入一件家具 → 单击芯片打标 → 保存到列表 → 导出 JSON,确认该家具 `tags` 正确、顶层 `tag_vocabulary` 正确。
- 重命名「植物」→「绿植」→ 所有引用它的家具 tags 同步改名。
- 删除「音乐」→ 词表移除 + 所有家具 tags 不再含「音乐」。
- 刷新页面(localStorage)→ 词表与各家具 tag 保持。
- 跑 `furniture-library.cjs` → `furniture_library.json` 里 custom 家具带上 `tags`。
