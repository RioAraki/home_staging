# Verplant & Zugestellt — Markdown bundle

> 中文版：[`README.zh.md`](README.zh.md)

This folder is a Markdown reformulation of the two PDFs in `..`:

- `..\18409_Anleitung_1_eng-UK-komprimiert.pdf` — the 5-page rulebook.
- `..\18409_Spiralbuch_1_eng-UK.pdf` — the 36-page mission book.

It exists so a future agent (or human) can implement an electronic version of the
game from a single, readable text source without having to OCR the PDFs again.

## File layout

```
md/
├── README.md          ← you are here
├── RULES.md           ← game rules in structured form
├── SCENARIOS.md       ← 25 scenarios + training + Essen-2023 bonus scenario
├── FURNITURE.md       ← catalogue of all 66 furniture cards (33 numbers × 2 variants)
├── tts_mapping.json   ← record of which TTS asset became which card image
└── images/
    ├── manual/        ← page_01.png … page_05.png   (one PNG per manual page)
    ├── scenarios/     ← page_01.png … page_36.png   (one PNG per mission-book page)
    └── cards/         ← furniture & room cards extracted from Steam Workshop mod
        ├── furniture/01_A.jpg … 33_A.jpg, 01_B.jpg … 33_B.jpg, 01_back.jpg …
        ├── rooms/room_01_face.jpg … room_05_back.jpg
        ├── furniture_variant{A,B}_sheet.jpg, furniture_deck_back.jpg
        ├── room_deck_{face,back}_sheet.jpg
        ├── score_sheet.jpg
        ├── marker_{question,exclaim}.png
        ├── bonus_scenario_{floorplan,rules}.jpg     (Essen 2023 promo, see SCENARIOS.md)
        └── ui_*.png                                  (TTS XML-UI sprites)
```

PNGs are rendered at 180 DPI. Each scenario in `SCENARIOS.md` links to the spread
that contains its floor plan — the floor plan image is **authoritative** for the
predetermined drawing every player must reproduce.

## What is in the MD, and what is still only in the images

| Information                                 | Where it lives                                   |
|---------------------------------------------|--------------------------------------------------|
| Rules of play                               | `RULES.md` (full text)                           |
| Scenario list, rooms, furniture #s, bonuses | `SCENARIOS.md` (full text)                       |
| Special rules per scenario                  | `SCENARIOS.md` (paraphrased; check image if unclear) |
| Predetermined floor plan (outline, trees, water, columns…) | `images/scenarios/page_NN.png` |
| Tiny diagrams / examples in the rules       | `images/manual/page_NN.png`                      |
| Furniture-card art (shape, options, open-spaces) | `images/cards/furniture/` (per-card images)    |
| Room-card art                                | `images/cards/rooms/`                            |
| Score sheet template                         | `images/cards/score_sheet.jpg`                   |
| Furniture-card shape data (occupied/open-space cells) | **Still TODO** — see `FURNITURE.md` schema. Images exist, structured YAML does not. |

## Provenance of the card images

The 66 furniture cards, 5 room cards, score sheet, and markers were extracted
from the user's local Tabletop Simulator workshop cache:

- Workshop mod: `https://steamcommunity.com/sharedfiles/filedetails/?id=3429711308`
  (Chinese localisation by *怡居巧匠*).
- Local source: `%USERPROFILE%\Documents\My Games\Tabletop Simulator\Mods\`
  - `Workshop\3429711308.json` (mod definition)
  - `Images\httpssteamusercontent…*.jpg/png` (TTS's URL-derived cache filenames)
- Sprite-sheet decks (5×2 rooms, 6×6 furniture × 2 variants) were sliced into
  per-card images at 1.5% border-bleed trim.
- The Essen-Spiel-2023 **bonus scenario** discovered in the mod (not in either
  PDF) is documented at the bottom of `SCENARIOS.md`.

## How a future agent should consume this bundle

1. Read `RULES.md` end-to-end to internalise the rules engine. Note which behaviours
   default vs. which a scenario can override.
2. Read `SCENARIOS.md` for the data model of a scenario:
   - difficulty, page reference,
   - room slots → furniture-card numbers,
   - bonus-point conditions (this is where most variation lives),
   - special rules (overrides).
3. To implement scenario floor plans, look at the linked page image and trace the
   pre-drawn outline / trees / columns / water onto a 16×16 grid (rows 1–16,
   columns A–P).
4. `FURNITURE.md` is incomplete. Before the game can actually be played
   electronically, capture each of the 66 cards' shape + open-spaces grid. The
   recommended YAML schema is in that file.

## Suggested electronification milestones

1. **Renderer** — display a 16×16 grid + the predetermined scenario layout from
   image data (one PNG per scenario).
2. **Card data** — fill in `FURNITURE.md` for all 66 cards. Without this, drawing
   furniture cannot be validated.
3. **Engine** — implement rules from `RULES.md`: turn structure, marker placement,
   joker, walls, accessibility check, scoring.
4. **Scenario loader** — parse `SCENARIOS.md` into a config (room list, bonuses,
   special-rule overrides). Special rules will likely need scenario-specific code.
5. **Multiplayer / solo** — one shared deck of cards, per-player sheets, optional
   networking.

## Open questions / gaps to verify against the physical game

- `FURNITURE.md` name list is a reconstruction — confirm against cards.
- A few special rules in scenarios 5, 13, 17, 18, 20 lean on the page image because
  the original text was tightly typeset against an example diagram (OCR collisions).
  Re-check those against `images/scenarios/page_NN.png` before coding.
- The exact "two cards per number" mapping (which variant pairs with which) cannot
  be reconstructed from the PDFs and must come from the physical deck.

## Provenance

- Game: *Verplant & Zugestellt* — Dr. Steffen Hacker, frechverlag GmbH (TOPP), 2023.
- This bundle was created from the two English-rules PDFs by extracting text with
  `pdftotext -layout`, rendering page images at 180 DPI with PyMuPDF, and writing
  the Markdown by hand using both sources.
