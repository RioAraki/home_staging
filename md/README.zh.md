# 怡居巧匠（Verplant & Zugestellt）— Markdown 资源包

此文件夹是把上级目录里的两份 PDF 改写后的 Markdown 版本：

- `..\18409_Anleitung_1_eng-UK-komprimiert.pdf` — 5 页英文规则书。
- `..\18409_Spiralbuch_1_eng-UK.pdf` — 36 页任务书。

存在目的：让以后接手的 agent（或人）能仅凭这一份可读文本就把游戏电子化，
而不必再 OCR 一遍 PDF。

> 英文版：[`README.md`](README.md)

## 文件结构

```
md/
├── README.zh.md        ← 你正在看的文件
├── README.md           ← 英文索引
├── RULES.zh.md / RULES.md           ← 游戏规则（中 / 英两版）
├── SCENARIOS.zh.md / SCENARIOS.md   ← 25 任务 + 训练 + 2023 埃森彩蛋
├── FURNITURE.zh.md / FURNITURE.md   ← 全 66 张家具卡目录（33 编号 × 2 变体）
├── tts_mapping.json    ← 哪个 TTS 资源对应到哪张卡图（记录用）
└── images/
    ├── manual/         ← page_01.png … page_05.png（规则书每页一图）
    ├── scenarios/      ← page_01.png … page_36.png（任务书每页一图）
    └── cards/          ← 从 Steam 工坊取出的家具/房间卡
        ├── furniture/01_A.jpg … 33_A.jpg、01_B.jpg … 33_B.jpg、01_back.jpg …
        ├── rooms/room_01_face.jpg … room_05_back.jpg
        ├── furniture_variant{A,B}_sheet.jpg、furniture_deck_back.jpg
        ├── room_deck_{face,back}_sheet.jpg
        ├── score_sheet.jpg
        ├── marker_{question,exclaim}.png
        ├── bonus_scenario_{floorplan,rules}.jpg     （2023 埃森彩蛋，见 SCENARIOS.zh.md）
        └── ui_*.png                                   （TTS XML-UI 微贴图）
```

PNG 以 180 DPI 渲出。`SCENARIOS.zh.md` 里每个任务都链接到对应的跨页图——
那张图里的预绘内容（轮廓、树、水、立柱等）以图为准，每位玩家必须 1:1 抄到图纸上。

## 文档里有什么、还差什么

| 信息                                       | 存放位置                                              |
|--------------------------------------------|-------------------------------------------------------|
| 游戏规则                                   | `RULES.zh.md`（全文）                                 |
| 任务清单、房间、家具编号、奖励              | `SCENARIOS.zh.md`（全文）                             |
| 每个任务的特殊规则                          | `SCENARIOS.zh.md`（已意译；不清楚处对照图）           |
| 预绘户型（轮廓/树/水/立柱…）                | `images/scenarios/page_NN.png`                        |
| 规则书里的小示意图/示例                    | `images/manual/page_NN.png`                           |
| 家具卡卡面（形状、选项、自由空间）         | `images/cards/furniture/`（按编号分图）               |
| 房间卡卡面                                 | `images/cards/rooms/`                                 |
| 计分图纸模板                               | `images/cards/score_sheet.jpg`                        |
| 家具卡形状数据（占用格 / 自由空间格 坐标） | **仍是 TODO** — 见 `FURNITURE.zh.md` 给的 schema；图已就位，结构化数据还要录。 |

## 卡图来源

66 张家具卡 + 5 张房间卡 + 计分纸 + 标记盘，都是从用户本机 TTS 工坊缓存里取出来的：

- 工坊 mod：`https://steamcommunity.com/sharedfiles/filedetails/?id=3429711308`
  （怡居巧匠中文版）
- 本地路径：`%USERPROFILE%\Documents\My Games\Tabletop Simulator\Mods\`
  - `Workshop\3429711308.json`（mod 定义文件）
  - `Images\httpssteamusercontent…*.jpg/png`（TTS 按 URL 派生的缓存文件名）
- 拼图分布是：5×2 房间，6×6 家具（两套变体）。统一切片，按 1.5% 边缘裁掉印刷出血。
- 工坊里附带的 **2023 埃森桌游展彩蛋关**（两份 PDF 里没有）在 `SCENARIOS.zh.md`
  末尾有说明。

## 后续 agent 的使用顺序

1. 把 `RULES.zh.md` 通读一遍掌握规则引擎，留意哪些行为是默认、哪些可被任务覆盖。
2. 看 `SCENARIOS.zh.md` 摸清任务数据结构：难度、跨页图编号、房间→家具编号、奖励分条件、特殊规则覆盖。
3. 要实现某个任务的预绘户型，照对应页图把轮廓/树/立柱/水域描到 16×16 方格（行 1–16、列 A–P）上。
4. `FURNITURE.zh.md` 把 66 张卡按编号都列出来了，但形状数据还没结构化。要让游戏真正能玩，
   还得照 schema 给每张卡的每个 option 录入占用格 + 自由空间格。

## 电子化里程碑

1. **渲染器** — 显示 16×16 方格 + 当前任务的预绘户型（每个任务一张 PNG）。
2. **卡牌数据** — 把 `FURNITURE.zh.md` 里 33 × 2 张卡的形状全部录入；没这一步，画家具就没法校验。
3. **引擎** — 把 `RULES.zh.md` 里的逻辑实现出来：回合流、标记盘、万能牌、墙、可达性校验、计分。
4. **任务加载器** — 解析 `SCENARIOS.zh.md` 成配置（房间列表、奖励、特殊规则覆盖）。特殊规则估计要按任务写专门代码。
5. **多人 / 单人** — 全桌共用一副卡，每人一张图纸，可加联机。

## 还需要核对的坑

- `FURNITURE.zh.md` 里的家具名是凭工坊版卡面 + 场景文本拼出来的，请照实物卡复核。
- 任务 5、13、17、18、20 的特殊规则原文排版被示意图遮挡过，OCR 串行；我虽对照页图整理过，但仍建议照
  `images/scenarios/page_NN.png` 再过一遍。
- 「每个编号两张变体」的具体配对关系在 PDF 里无法还原，必须以实物卡为准。
- 2023 埃森彩蛋关里的家具编号是我盯着小字读的，请以 `bonus_scenario_rules.jpg` 为准。

## 来源说明

- 游戏：*Verplant & Zugestellt* — Dr. Steffen Hacker，frechverlag GmbH（TOPP 品牌），2023。
- 本资源包由两份英文规则 PDF 提取生成：用 `pdftotext -layout` 抽文本，用 PyMuPDF 以 180 DPI 渲页图，
  然后手写整理 Markdown，并补入工坊 mod 的卡图。
