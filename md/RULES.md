# Verplant & Zugestellt — Game Rules

> 中文版：[`RULES.zh.md`](RULES.zh.md)
>
> Source: `18409_Anleitung_1_eng-UK-komprimiert.pdf` (5-page rulebook).
> This document is a structured Markdown reformulation for electronification. For any
> visual that an electronic implementation must reproduce (card art, example diagrams,
> example walls, scoring example), refer to the original page image linked at the top
> of each section.

- **Game design:** Dr. Steffen Hacker
- **Publisher:** frechverlag GmbH (TOPP), 2023
- **Players:** 2–6 (works solo too)
- **Age:** 10+
- **Length:** ~30 min
- **Genre:** roll-and-write / draw-and-write floor-plan game

## Premise

Each player runs an interior-design firm. Working from the same brief, every player
sketches furniture and rooms on a blank grid floor plan on their own sheet, trying to
satisfy the client. Whoever scores the most points at the end wins.

---

## Game components (page image: `images/manual/page_02.png`)

| Component             | Qty | Role |
|-----------------------|-----|------|
| Furniture cards       | 66  | 33 distinct furniture numbers × 2 variants per number. |
| Room cards            | 5   | Generic room headers (Room I–V) the furniture cards are sorted under. |
| Furniture markers     | 25  | Round chips, two-sided: "?" side up = furniture to place; "!" side up = forced furniture (see §1); green side = joker trigger. |
| Game material pad     | —   | Tear-off sheets pre-printed with a 16-row × 16-col grid (rows 1–16, cols A–P) and score boxes. |
| Mission book          | —   | 25 scenarios + a training mission. See `SCENARIOS.md`. |
| Per player            | —   | A pencil and (sooner or later) an eraser. |

### Furniture cards — anatomy

- Each card shows one or more **options** (a named piece + grid sketch). A single
  card can carry 1, 2 or 3 options stacked on its face; the active player chooses
  which option the table actually draws this turn.
- Every card carries a **furniture number** (1–33). Two physical cards exist for
  every number — call them **Variant A** and **Variant B**. They share the number
  but show different option sets, e.g. variant A of #8 shows "toilet" / "toilet
  with plant" while variant B of #8 shows "toilet with sink" / "toilet with shelf".
- Each option's sketch marks:
  - **occupied squares** (dark): count for scoring,
  - **open-space squares** (light hatched): must stay walkable,
  - an optional **thick wall edge** on one side: that edge must abut a wall.
- Some cards carry one or two **furniture markers** printed on the card itself,
  indicating that more than one copy of the piece must be installed.
- The catalogue of all 66 cards lives in `FURNITURE.md` and the per-card images
  are in `images/cards/furniture/`.

### Room cards

There are 5 room cards (I, II, III, IV, V). They are used as column headers; the
mission tells you which furniture card numbers belong under each room.

---

## Setup (page image: `images/manual/page_02.png`)

1. Pick a mission from the mission book. Difficulty is signalled by the number of
   highlighted pencils on the page: training / easy / medium / hard.
2. Every player takes a fresh sheet from the pad and writes their name + the mission
   name on it. New players should start with the training scenario.
3. Read the mission's flavour text aloud.
4. On every sheet, draw the floor plan exactly as printed in the mission: outline,
   trees, roads, walls, water, columns, etc.
5. Lay the room cards out in a vertical column matching the mission's room list.
   Beside each room card, place the furniture cards whose numbers the mission lists
   for that room.
   - **Random variant rule:** for each number, take one of the two physical cards
     **without looking at its back**. Keep the stack ordered, do not shuffle.
6. Onto each furniture card, place as many furniture markers (question-mark side up)
   as the mission indicates.
7. Read any mission-specific bonus points, special rules, and tips aloud.
8. Whoever drew something most recently starts.

---

## Turn structure (page image: `images/manual/page_03.png`)

On their turn, the active player runs steps 1 → 2 → optional 3. After their turn,
play passes to the left.

### 1. Select a piece of furniture

- The first time you enter a room, flip its room card face up.
- Choose any face-down furniture card from the *current* room (you cannot skip to a
  later room — every room must be completed first; see §3).
- Flip the chosen card. It shows one piece of furniture **plus** marked open spaces.
- For each marker on the card, the active player decides which actual piece of
  furniture is being installed. Place the marker onto that piece **with the "!" side
  up**. After all markers are placed, go to step 2.
  - Most cards show only one piece, in which case the marker just sits on top.
  - Some cards show 2–3 options (e.g. "Toilet" / "Toilet with plant" /
    "Toilet with shelf") and the active player picks which option everyone will draw.

### 2. Draw furniture (all players, simultaneously)

- Every player draws the chosen piece(s) into their own floor plan.
- Drawing is **optional** — any player may pass and skip drawing it.
- You may **rotate** the piece freely. You may **not mirror it** (exception: see Joker).
- You may **not** draw over predetermined elements (trees, roads, walls, water, etc.)
  printed by the mission or carried over from earlier cards (see §"Important design
  rules").
- Open spaces are part of every piece and must stay empty — but open spaces from
  *different* pieces are allowed to **overlap each other**. A useful drawing
  convention: dot the centre of each open-space square and lightly shade the
  furniture itself.
- Non-walkable squares (squares with neither a dot nor a piece of furniture) are
  fine to leave blank.
- **Carpet (number 33)** is the exception to "open spaces stay empty": you can walk
  onto a carpet, it does not count as an occupied square at scoring, and it only
  contributes bonus points. Draw the fringe around the squares it covers.

### 3. Completing the room

Once every furniture card for the current room has been flipped and drawn (or passed
on), the room is closed:

- Each player draws **walls** around their room. Walls do not have to hug the
  furniture exactly; non-walkable squares may live inside the walls.
- Each room must have **exactly one door**.
- Only after walls are drawn may a new room be started (with its preset furniture
  cards).

---

## Important design rules (page images: `images/manual/page_03.png`, `images/manual/page_04.png`)

### Hallway (default)

Unless the mission overrides it:

- All rooms must be reachable. They are reached through a **hallway**, not by walking
  through another room.
- The hallway connects the front door to every room's door.
- The hallway can be any width, any length, and must form one continuous piece of
  empty squares. No furniture is placed in the hallway.

### Front door

Unless the mission overrides it, the front door may be drawn into any exterior wall
of the hallway, at any time and at any location.

### No-hallway missions

Some scenarios say "no hallway". In that case the front door adjoins the named room
directly; further rooms also adjoin that room directly via their own doors.

### Walls printed on a card

Some pieces of furniture come with a thicker line on one side — that side must abut a
wall (interior or exterior). The wall itself can still be shared with an existing
wall, but you cannot put a door through this section.

### Distances

Distance between two objects = the shortest **walking path** between them, moving
only horizontally and vertically (no diagonals). Detours around walls or furniture
count.

### Windows

You can draw windows anywhere on an exterior wall. The square in front of a window
does **not** have to be free; furniture may stand in front of it. Windows are pure
decoration unless the mission grants bonus points for one being in straight line of
sight to a target (e.g. a tree, the sea, a lake).

### Unconnected open spaces on a card

Some cards mark several open spaces that are not connected on the card itself. They
must still all be reachable in the final floor plan.

### Accessibility of rooms and pieces of furniture

At end of game, every piece of furniture must be reachable from the front door —
i.e. every open space must be path-connected to every other open space and to the
hallway/door. Pieces whose open spaces are not all accessible **score nothing**.

### Joker (one-time per game)

The first time the *green* furniture marker is placed on a card, any player may
spend their Joker to either:

- swap to the other (face-down) physical card for that furniture number, **or**
- mirror the piece they are about to draw.

When you use the Joker, cross out the lightbulb on your sheet. The Joker applies to
**one** piece of furniture only, even if several markers were placed at once. The
joker must be announced before drawing.

---

## End of the game and scoring (page image: `images/manual/page_04.png`)

The game ends when all furniture cards have been revealed and every player has
either drawn the last piece or passed.

Each player tots up points in the score boxes under their floor plan:

- **+1** for every square occupied by a piece of furniture, **only** counting rooms
  and pieces whose open spaces are accessible from the front door via the hallway.
- **0** for open spaces.
- **−3** penalty for any room with no furniture drawn in it (the room counts as
  nonexistent).
- **+ mission bonuses** as listed in the scenario.

Highest total wins. The example scorecard on `images/manual/page_04.png` walks
through the training scenario at score = 27.

### Special rules (per scenario)

A scenario's "Special rules" can override anything in this rulebook. If a special
rule contradicts a general rule, the special rule wins.

---

## Credits (page image: `images/manual/page_05.png`)

- Game design: Dr. Steffen Hacker
- Cover illustration: Clément Masson
- Card illustration: Ekaterina Danilyuk, Melanie Herrmann
- Packaging design: Melanie Herrmann
- English translation: Spieletexter Ludiversal Translations / Danny Aaron Menges
- Editing & layout (EN): Michael Csorba
- Publisher: frechverlag GmbH (a Penguin Random House Verlagsgruppe imprint),
  Gerlingen, Germany — 1st Edition 2023
- GTIN 40-07742-18409-4 · Best.-Nr. 18409

---

## Glossary (for the implementer)

| Term            | Meaning                                                                                      |
|-----------------|----------------------------------------------------------------------------------------------|
| Floor plan      | The 16×16 grid printed on the player sheet (rows 1–16, columns A–P).                         |
| Predetermined  | Anything the mission tells you to draw at setup. Cannot be overwritten by furniture.         |
| Occupied square | A square covered by furniture itself (not its open space).                                   |
| Open space      | A square the furniture needs walkable in front of it (marked on the card).                   |
| Hallway         | The empty, connected corridor linking the front door to every room door.                     |
| Variant A / B   | The two physical cards that share a furniture number; one is chosen blind at setup.          |
| Joker           | One-time per game per player: swap card variant or mirror the piece. Marked by the lightbulb.|
