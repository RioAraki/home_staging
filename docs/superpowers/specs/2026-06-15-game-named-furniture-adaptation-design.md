# 游戏本体适配命名家具

日期：2026-06-15。

## 约束
- cocos 游戏本体**无法 headless 验证**——只能跑 vitest(逻辑)+ 浏览器(编辑器)。
- 硬约束:**现有 27 个编号关卡 + 全部现有测试不得破坏**;命名分支只在 `room.furniture`(名字)存在时激活。
- 新逻辑尽量抽成 cc-free 纯函数并单测;渲染/UI 按现有模式实现,最后交接给用户在 Cocos 里验证。

## 关键认知(降风险)
- **卡牌转来的命名家具**(如「马桶 8A-1」)携带 number/variant/option_index → 复用整条现有管线(几何、校验、计分、地毯判定、vector PNG 渲染)。
- **自定义家具**(如「长沙发」)是唯一全新情况:无 number,几何来自 tiles。
- 杠杆点:`pieces.ts` 的 `resolveOption(p)`。让它支持按名字解析 → 几何/校验/计分自动适配。

## 组件

### 1. 统一家具库(数据) `tools/furniture-library.cjs`
合并 `asset/cards_furniture.json`(卡牌 132)+ `asset/furniture_collection.json`(自定义)→ `cocos/.../assets/resources/data/furniture_library.json`,条目规范:
- card:`{name, source:'card', number, variant, option_index, bbox, shape, open_spaces, wall_edges, name_zh, printed_markers}`
- custom:`{name, source:'custom', bbox, shape(=tiles 的 [row,col]), open_spaces(=open_cells), wall_edges:[], name_zh:name, tiles}`
GameBootstrap 加载它,`setLoadedData(maps, furniture, library)`。

### 2. 解析层 `core/dataLoader.ts` + `core/pieces.ts`
- dataLoader:`furnitureByName(name)`、`furnitureOptionByName(name)→FurnitureOption`。
- `PieceRef` 增可选 `name?`、`source?`。`resolveOption(p)`:`p.name` → 按名字解析;否则走 cardByNumberVariant。
- 地毯:卡牌命名家具仍带 number(33)→ 现有 `p.number===CARPET_NUMBER` 照常;自定义 number=0 → 安全不匹配。几何/计分零改动地工作。

### 3. 房间流程 `core/roomItems.ts`(cc-free,单测)
`roomItems(room): RoomItem[]`,`RoomItem = {kind:'named',name} | {kind:'numbered',number}`:有 `furniture` 用名字,否则用 `furniture_numbers`。
gameStore 把所有 `furniture_numbers.length`/索引(lookupNumber、currentCard、currentCardIndexOf、getRoomPhase、reveal 构建 chosenVariants、selectOption)改走 roomItems。命名家具每个名字=一张「单选项卡」(名字已定形,无 A/B、无双 option),旋转/镜像仍可用。

### 4. 渲染(按现有模式,需 Cocos 验证)
- `PlacedPiece.ts`:`source==='custom'` → 用 Graphics 画 footprint(外形填充 + open 点,类似 ghost,免额外资源);否则现有 vector PNG。
- `GhostPiece.ts`:已是几何 Graphics,命名家具自动可用(只要 selectedOption 带正确几何)。
- `RoomPanel.ts` / `RoomProgressPanel.ts`:命名房间每名字呈现一张卡(卡牌→vector PNG;自定义→footprint/简框);进度计数走 roomItems。

### 5. 计分/奖励
绝大多数走 `resolveOption`/几何 → 命名家具自动可用。按 number 的奖励(covers_marker、all_installed 等)对卡牌命名家具有效(带 number);自定义家具不参与编号类奖励(合理,自建关卡不依赖书中奖励)。

## 测试(可验证部分)
- furniture-library 生成:数量、字段、custom shape=tiles。
- furnitureByName/Option、resolveOption(named) 解析正确(card + custom)。
- roomItems:named/numbered 分支、长度、取项。
- pieceShapeCells/open 对命名家具(custom + card)给出正确世界格。
- 全部现有测试保持通过。

## 交接(需用户在 Cocos 验证)
渲染外观、tray 交互、整局可玩性(选→放→建造→结算)。提供逐项 checklist。

## 不做
- 不把 asset/tiles 拷进 cocos(自定义家具用 footprint 渲染,不用 tile 图)。
- 不改编号关卡流程(只在命名房间激活新分支)。
