# Furniture Card Catalogue

> 中文版：[`FURNITURE.zh.md`](FURNITURE.zh.md)
>
> All 66 furniture cards (33 numbers × 2 variants) have been extracted from the
> Steam Workshop mod `3429711308` (Chinese localisation by *怡居巧匠*) and saved
> to `images/cards/furniture/`. The original German PDF rulebook does not carry
> this card-level art — it must come from the physical deck or, as here, from
> the workshop's reproduction.

## Asset layout

```
images/cards/
├── furniture/
│   ├── 01_A.jpg … 33_A.jpg     ← Variant A of each number
│   ├── 01_B.jpg … 33_B.jpg     ← Variant B of each number
│   └── 01_back.jpg … 33_back.jpg ← shared blue card-back (the "face-down" look)
├── rooms/
│   ├── room_01_face.jpg … room_05_face.jpg ← Room I..V (face-up cover)
│   └── room_01_back.jpg … room_05_back.jpg ← Room I..V (face-down side)
├── furniture_variantA_sheet.jpg ← original 6×6 sprite sheet (A)
├── furniture_variantB_sheet.jpg ← original 6×6 sprite sheet (B)
├── furniture_deck_back.jpg      ← original 6×6 sheet, blue back
├── room_deck_face_sheet.jpg     ← original 5×2 sheet
├── room_deck_back_sheet.jpg     ← original 5×2 sheet
├── score_sheet.jpg              ← per-player score-sheet template (16×16 grid)
├── marker_question.png          ← "?" side of the 25 furniture markers
├── marker_exclaim.png           ← "!" side (active-placement marker)
├── bonus_scenario_floorplan.jpg ← workshop-included bonus scenario (Essen 2023)
├── bonus_scenario_rules.jpg     ← bonus scenario room/bonus/special-rules page
└── ui_*.png                     ← 4 tiny XML-UI sprites from the TTS mod
```

## How a card is structured

Every furniture-card variant image shows **one or two "options"** stacked on the
card. Each option has:
- a Chinese name with a hand-drawn arrow pointing at its grid sketch,
- a top-down grid sketch on a 2×3 / 3×3 / etc. micro-grid where:
  - **dark/shaded cells** = the furniture occupies that square (counts at scoring),
  - **light hatched cells** = open-space cells that must remain walkable,
  - a **thick black line** on one edge means that side must abut a wall.

When the card is flipped during play, the active player chooses which of the
options the table draws (rules: §1 in `RULES.md`).

## Card catalogue (33 numbers × 2 variants)

> Names are read from the workshop cards (Chinese) with the English equivalent
> taken from the scenario text in `SCENARIOS.md`. Verify against the physical
> deck before relying on names; shapes are authoritative from the linked images.

| #  | Chinese name(s) seen on card                | English handle              | Variant A           | Variant B           |
|---:|---------------------------------------------|------------------------------|---------------------|---------------------|
| 01 | 长沙发 / 带灯长沙发                          | Long sofa                    | `furniture/01_A.jpg`| `furniture/01_B.jpg`|
| 02 | 小沙发 / 带植物的小沙发                      | Small sofa                   | `furniture/02_A.jpg`| `furniture/02_B.jpg`|
| 03 | 置物架 / 转角置物架                          | Shelf                        | `furniture/03_A.jpg`| `furniture/03_B.jpg`|
| 04 | 大型桌子 / 长桌                              | Large table                  | `furniture/04_A.jpg`| `furniture/04_B.jpg`|
| 05 | 小型桌子                                    | Small table                  | `furniture/05_A.jpg`| `furniture/05_B.jpg`|
| 06 | 大型厨房 / 转角厨房                          | Big kitchen                  | `furniture/06_A.jpg`| `furniture/06_B.jpg`|
| 07 | 小型厨房 / 小厨房                            | Small kitchen / kitchen unit | `furniture/07_A.jpg`| `furniture/07_B.jpg`|
| 08 | 马桶 / 带植物的马桶 / 带洗手设备的马桶 / 带置物架的马桶 | Toilet                  | `furniture/08_A.jpg`| `furniture/08_B.jpg`|
| 09 | 洗手台 / 洗手台变体                          | Sink                         | `furniture/09_A.jpg`| `furniture/09_B.jpg`|
| 10 | 淋浴间 / 浴缸                                | Shower / Bathtub             | `furniture/10_A.jpg`| `furniture/10_B.jpg`|
| 11 | 桑拿房 / 按摩浴缸                            | Wellness (sauna / whirlpool) | `furniture/11_A.jpg`| `furniture/11_B.jpg`|
| 12 | 大型床 / 双人床                              | Large bed / double bed       | `furniture/12_A.jpg`| `furniture/12_B.jpg`|
| 13 | 小型床                                      | Small bed                    | `furniture/13_A.jpg`| `furniture/13_B.jpg`|
| 14 | 大型橱柜 / 大冰箱                            | Large wardrobe / large fridge| `furniture/14_A.jpg`| `furniture/14_B.jpg`|
| 15 | 小型橱柜 / 抽屉柜                            | Small wardrobe / dresser     | `furniture/15_A.jpg`| `furniture/15_B.jpg`|
| 16 | 大型办公桌 / 转角大办公桌                    | Large desk                   | `furniture/16_A.jpg`| `furniture/16_B.jpg`|
| 17 | 小办公桌 / 转角小办公桌                      | Small desk                   | `furniture/17_A.jpg`| `furniture/17_B.jpg`|
| 18 | 大型植物                                    | Large plant                  | `furniture/18_A.jpg`| `furniture/18_B.jpg`|
| 19 | 小型植物                                    | Small plant                  | `furniture/19_A.jpg`| `furniture/19_B.jpg`|
| 20 | 沙发组 / 沙发茶几组                          | Seating group                | `furniture/20_A.jpg`| `furniture/20_B.jpg`|
| 21 | 转角家具 / 角柜墙                            | Corner unit / wall-cabinet   | `furniture/21_A.jpg`| `furniture/21_B.jpg`|
| 22 | 婴儿装备                                    | Baby equipment               | `furniture/22_A.jpg`| `furniture/22_B.jpg`|
| 23 | 儿童玩具                                    | Children's toy               | `furniture/23_A.jpg`| `furniture/23_B.jpg`|
| 24 | 小动物饲养设备                              | Pet / small-animal supplies  | `furniture/24_A.jpg`| `furniture/24_B.jpg`|
| 25 | 爱好装备                                    | Hobby equipment              | `furniture/25_A.jpg`| `furniture/25_B.jpg`|
| 26 | 运动器材                                    | Sports device                | `furniture/26_A.jpg`| `furniture/26_B.jpg`|
| 27 | 乐器                                        | Musical instrument           | `furniture/27_A.jpg`| `furniture/27_B.jpg`|
| 28 | 音箱 / 扩音器                                | Amplifier                    | `furniture/28_A.jpg`| `furniture/28_B.jpg`|
| 29 | 电视 / 游戏桌                                | TV / game table              | `furniture/29_A.jpg`| `furniture/29_B.jpg`|
| 30 | 吧台 / 柜台                                  | Counter / bar                | `furniture/30_A.jpg`| `furniture/30_B.jpg`|
| 31 | 火炉 / 皂石壁炉                              | Stove / fireplace            | `furniture/31_A.jpg`| `furniture/31_B.jpg`|
| 32 | 艺术品                                      | Piece of art                 | `furniture/32_A.jpg`| `furniture/32_B.jpg`|
| 33 | 波斯地毯 / 两列式地毯                        | Carpet                       | `furniture/33_A.jpg`| `furniture/33_B.jpg`|

## Special pieces

- **Carpet (#33)** is the only piece a player may walk on. It does not count as
  an occupied square at scoring and only contributes bonus points.
- **Plants (#18, #19)** in scenario 23 ("The Enchanted Greenhouse") may be drawn
  on top of other furniture's open spaces and must form connected colonies.

## Mechanical data

A full first-pass digitisation of every option on every card lives in
[`furniture_data.yaml`](furniture_data.yaml). Per option it records the bounding
box, occupied cells, open-space cells, wall-edge requirements, and a free-text
`notes` field. Coordinates use `[row, col]`, 0-indexed inside each option's own
minimal bounding box.

Stats (validated):

- 66 card rows (33 numbers × 2 variants)
- 132 options total (every card carries 2 options)
- 0 missing fields, 0 cells outside their declared bbox

Roughly 71 of the 132 options are flagged with `verify: true` — these are the
multi-piece, L-shape and irregular layouts where I want the physical card eyed
before relying on the coordinates. The simpler 1- and 2-cell layouts are
unflagged and should be trustworthy as-is. Search for `verify: true` to find
them.

### Per-option schema

```yaml
- number: 8
  variant: A             # A or B
  image: images/cards/furniture/08_A.jpg
  options:
    - option_index: 1    # 1..3 within this card
      name_zh: "马桶"
      name_en: "Toilet"
      bbox: [1, 2]       # [rows, cols] of the option's minimal bbox
      shape: [[0, 1]]    # cells the furniture occupies (counts at scoring)
      open_spaces:       # cells that must stay walkable
        - [0, 0]
      wall_edges: [right]      # any of top/right/bottom/left, [] = no requirement
      printed_markers: 0       # markers printed on the card face
      notes: ""                # free-text caveats
      verify: true             # (optional) flag for manual re-check
```

If you want to slice or compose these computationally, `tts_mapping.json`
already records the source asset URLs and local cache paths the data came from.

## Cross-reference

- Rules that govern furniture placement: see `RULES.md` §1 (selecting), §2
  (drawing), and §"Important design rules" (open-space connectivity, walls,
  joker).
- Scenarios that pin specific furniture numbers to rooms: see `SCENARIOS.md`.
