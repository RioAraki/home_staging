# 家具卡目录

> 全部 66 张家具卡（33 个编号 × 2 种变体）已从 Steam 创意工坊 `3429711308`
> （怡居巧匠中文版）取出，存放在 `images/cards/furniture/`。原版德语/英语规则书并
> 没有印这些卡面的形状图——只能从实物卡，或像这里一样从工坊还原版中获取。
>
> 英文版：[`FURNITURE.md`](FURNITURE.md)

## 资源布局

```
images/cards/
├── furniture/
│   ├── 01_A.jpg … 33_A.jpg         ← 每号的变体 A
│   ├── 01_B.jpg … 33_B.jpg         ← 每号的变体 B
│   └── 01_back.jpg … 33_back.jpg   ← 蓝色卡背（牌堆朝下默认看到的那面）
├── rooms/
│   ├── room_01_face.jpg … room_05_face.jpg  ← 房间 I–V 正面（彩色封）
│   └── room_01_back.jpg … room_05_back.jpg  ← 房间 I–V 背面
├── furniture_variantA_sheet.jpg     ← 原始 6×6 拼图（变体 A）
├── furniture_variantB_sheet.jpg     ← 原始 6×6 拼图（变体 B）
├── furniture_deck_back.jpg          ← 原始 6×6 拼图（蓝卡背）
├── room_deck_face_sheet.jpg         ← 原始 5×2 拼图（房间正面）
├── room_deck_back_sheet.jpg         ← 原始 5×2 拼图（房间背面）
├── score_sheet.jpg                  ← 单人计分图纸模板（16×16 格）
├── marker_question.png              ← 25 枚家具标记盘的「?」面
├── marker_exclaim.png               ← 「!」面（已被选中标记）
├── bonus_scenario_floorplan.jpg     ← 工坊附赠的奖励任务户型图（2023 埃森展）
├── bonus_scenario_rules.jpg         ← 奖励任务的房间/奖励分/特殊规则页
└── ui_*.png                         ← 4 个微型 XML UI 贴图
```

## 一张卡的结构

每张家具卡上叠放着 **1 个或 2 个 option（选项）**，每个选项包含：
- 一个中文家具名 + 一根手绘箭头指向它的方格草图；
- 一张俯视格子图（2×3、3×3 等小方格）：
  - **深色填实格** = 家具占用，计分时算分；
  - **浅色斜纹格** = 自由空间（open space），必须保持可走；
  - 某一侧的 **加粗黑线** = 此侧必须紧贴墙。

翻开这张卡时，由当前玩家选定全桌要画上面哪一个选项（详见 `RULES.zh.md` §1）。

## 卡牌目录（33 个编号 × 2 种变体）

> 中文名取自工坊版卡面，英文 handle 来自 `SCENARIOS.zh.md` 里出现的场景文字。
> 形状以图为准；名字若与实物卡有出入，以实物卡为准。

| #   | 中文名（取自卡面）                          | 英文 handle                  | 变体 A              | 变体 B              |
|----:|--------------------------------------------|------------------------------|---------------------|---------------------|
| 01  | 长沙发 / 带灯长沙发                         | Long sofa                    | `furniture/01_A.jpg`| `furniture/01_B.jpg`|
| 02  | 小沙发 / 带植物的小沙发                     | Small sofa                   | `furniture/02_A.jpg`| `furniture/02_B.jpg`|
| 03  | 置物架 / 转角置物架                         | Shelf                        | `furniture/03_A.jpg`| `furniture/03_B.jpg`|
| 04  | 大型桌子 / 长桌                             | Large table                  | `furniture/04_A.jpg`| `furniture/04_B.jpg`|
| 05  | 小型桌子                                   | Small table                  | `furniture/05_A.jpg`| `furniture/05_B.jpg`|
| 06  | 大型厨房 / 转角厨房                         | Big kitchen                  | `furniture/06_A.jpg`| `furniture/06_B.jpg`|
| 07  | 小型厨房 / 小厨房                           | Small kitchen / kitchen unit | `furniture/07_A.jpg`| `furniture/07_B.jpg`|
| 08  | 马桶 / 带植物的马桶 / 带洗手设备的马桶 / 带置物架的马桶 | Toilet              | `furniture/08_A.jpg`| `furniture/08_B.jpg`|
| 09  | 洗手台 / 洗手台变体                         | Sink                         | `furniture/09_A.jpg`| `furniture/09_B.jpg`|
| 10  | 淋浴间 / 浴缸                               | Shower / Bathtub             | `furniture/10_A.jpg`| `furniture/10_B.jpg`|
| 11  | 桑拿房 / 按摩浴缸                           | Wellness（桑拿/按摩浴缸）     | `furniture/11_A.jpg`| `furniture/11_B.jpg`|
| 12  | 大型床 / 双人床                             | Large bed / double bed       | `furniture/12_A.jpg`| `furniture/12_B.jpg`|
| 13  | 小型床                                     | Small bed                    | `furniture/13_A.jpg`| `furniture/13_B.jpg`|
| 14  | 大型橱柜 / 大冰箱                           | Large wardrobe / large fridge| `furniture/14_A.jpg`| `furniture/14_B.jpg`|
| 15  | 小型橱柜 / 抽屉柜                           | Small wardrobe / dresser     | `furniture/15_A.jpg`| `furniture/15_B.jpg`|
| 16  | 大型办公桌 / 转角大办公桌                   | Large desk                   | `furniture/16_A.jpg`| `furniture/16_B.jpg`|
| 17  | 小办公桌 / 转角小办公桌                     | Small desk                   | `furniture/17_A.jpg`| `furniture/17_B.jpg`|
| 18  | 大型植物                                   | Large plant                  | `furniture/18_A.jpg`| `furniture/18_B.jpg`|
| 19  | 小型植物                                   | Small plant                  | `furniture/19_A.jpg`| `furniture/19_B.jpg`|
| 20  | 沙发组 / 沙发茶几组                         | Seating group                | `furniture/20_A.jpg`| `furniture/20_B.jpg`|
| 21  | 转角家具 / 角柜墙                           | Corner unit / wall-cabinet   | `furniture/21_A.jpg`| `furniture/21_B.jpg`|
| 22  | 婴儿装备                                   | Baby equipment               | `furniture/22_A.jpg`| `furniture/22_B.jpg`|
| 23  | 儿童玩具                                   | Children's toy               | `furniture/23_A.jpg`| `furniture/23_B.jpg`|
| 24  | 小动物饲养设备                             | Pet / small-animal supplies  | `furniture/24_A.jpg`| `furniture/24_B.jpg`|
| 25  | 爱好装备                                   | Hobby equipment              | `furniture/25_A.jpg`| `furniture/25_B.jpg`|
| 26  | 运动器材                                   | Sports device                | `furniture/26_A.jpg`| `furniture/26_B.jpg`|
| 27  | 乐器                                       | Musical instrument           | `furniture/27_A.jpg`| `furniture/27_B.jpg`|
| 28  | 音箱 / 扩音器                               | Amplifier                    | `furniture/28_A.jpg`| `furniture/28_B.jpg`|
| 29  | 电视 / 游戏桌                               | TV / game table              | `furniture/29_A.jpg`| `furniture/29_B.jpg`|
| 30  | 吧台 / 柜台                                 | Counter / bar                | `furniture/30_A.jpg`| `furniture/30_B.jpg`|
| 31  | 火炉 / 皂石壁炉                             | Stove / fireplace            | `furniture/31_A.jpg`| `furniture/31_B.jpg`|
| 32  | 艺术品                                     | Piece of art                 | `furniture/32_A.jpg`| `furniture/32_B.jpg`|
| 33  | 波斯地毯 / 两列式地毯                       | Carpet                       | `furniture/33_A.jpg`| `furniture/33_B.jpg`|

## 特殊家具

- **地毯（#33）** 是全桌唯一可以踩着走的家具：占用格不计分，仅为奖励分服务。
- **植物（#18、#19）** 在任务 23「魔法温室」里可以画在其他家具的自由空间上，且必须成片相连。

## 机制化数据

每张卡每个 option 的完整初稿已写入 [`furniture_data.yaml`](furniture_data.yaml)。
每条记录包含包围盒、占用格、自由空间格、必须靠墙的边、以及一段 `notes` 备注。
坐标采用 `[row, col]`、0-indexed，相对每个 option 自己的最小包围盒。

统计（已通过校验）：

- 66 行卡（33 编号 × 2 变体）
- 132 个 option（每张卡 2 个 option）
- 0 字段缺失、0 坐标越界

其中 71/132 的 option 标了 `verify: true`——这些是多块拼接、L 形、不规则形状，我希望
拿着实物卡再核对一次再用。简单的 1–2 格形状没标，可以直接信任。要找待复核项搜
`verify: true` 即可。

### 单 option schema

```yaml
- number: 8
  variant: A             # A 或 B
  image: images/cards/furniture/08_A.jpg
  options:
    - option_index: 1    # 同卡内 1..3
      name_zh: "马桶"
      name_en: "Toilet"
      bbox: [1, 2]       # [rows, cols] 该 option 的最小包围盒
      shape: [[0, 1]]    # 家具占用格（计分时算分）
      open_spaces:       # 必须保持可走的自由空间格
        - [0, 0]
      wall_edges: [right]      # top/right/bottom/left 任意组合，[] 表示无要求
      printed_markers: 0       # 卡面印的家具标记盘数
      notes: ""                # 备注
      verify: true             # （可选）建议人工复核
```

要靠程序切片或合成的话，`tts_mapping.json` 里已经记好了素材的源 URL 和本地缓存路径。

## 交叉引用

- 与家具摆放相关的规则：见 `RULES.zh.md` §1（选家具）、§2（画家具）以及「重要的设计规则」
  （自由空间连通、卡上墙、万能牌）。
- 哪些任务把特定家具编号绑到哪个房间：见 `SCENARIOS.zh.md`。
