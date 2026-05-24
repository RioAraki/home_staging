# Verplant & Zugestellt — Scenario Index

> 中文版：[`SCENARIOS.zh.md`](SCENARIOS.zh.md)
>
> Source: `18409_Spiralbuch_1_eng-UK.pdf` (36-page mission book). Each scenario is
> summarised below in mechanical form. For the **floor plan layout** (predetermined
> outline, trees, walls, water, etc.) the original page image is authoritative — link
> follows each scenario header. Numbers in the room rows are **furniture card
> numbers** (see `FURNITURE.md`).
>
> **Machine-readable data:** [`maps_data.yaml`](maps_data.yaml) encodes the 16×16
> grid, predetermined elements, rule overrides and bonus conditions for every
> scenario. Validate with `python validate_maps.py`. Visualise grid alignment with
> `python overlay_maps.py` → `images/scenarios/_verify_<id>.png`.

## Chapter / scenario map

| #   | Chapter                  | Scenario                                         | Difficulty | Page  | Image                                |
|-----|--------------------------|--------------------------------------------------|-----------:|------:|--------------------------------------|
| —   | —                        | Training Scenario: 1 Room, Kitchen, Bathroom     | training   |   4–5 | `images/scenarios/page_03.png` |
| 1   | Soaring High             | The Alpine Wellness Hut                          | easy       |   8–9 | `images/scenarios/page_05.png` |
| 2   | Soaring High             | The Mountain Surgery                             | easy       | 10–11 | `images/scenarios/page_06.png` |
| 3   | Soaring High             | "Castle Café"                                    | easy       | 12–13 | `images/scenarios/page_07.png` |
| 4   | The Fantasy Fan          | The Rehearsal Room in the Old Barn               | easy       | 16–17 | `images/scenarios/page_09.png` |
| 5   | The Fantasy Fan          | The Game Store in the Old Town                   | easy       | 18–19 | `images/scenarios/page_10.png` |
| 6   | The Fantasy Fan          | Beutler's End                                    | medium     | 20–21 | `images/scenarios/page_11.png` |
| 7   | Club Life                | The Renovated Clubhouse                          | medium     | 24–25 | `images/scenarios/page_13.png` |
| 8   | Club Life                | The Eccentric Small Animal Breeder               | medium     | 26–27 | `images/scenarios/page_14.png` |
| 9   | Club Life                | Tiny Houses                                      | medium     | 28–29 | `images/scenarios/page_15.png` |
| 10  | A Story of Success       | Startup Tower                                    | medium     | 32–33 | `images/scenarios/page_17.png` |
| 11  | A Story of Success       | The State-of-the-Art Villa                       | medium     | 34–35 | `images/scenarios/page_18.png` |
| 12  | A Story of Success       | Shared Apartment with Good Connections           | medium     | 36–37 | `images/scenarios/page_19.png` |
| 13  | The Old Factory Site     | The Forgotten Railway Wagon                      | hard       | 40–41 | `images/scenarios/page_21.png` |
| 14  | The Old Factory Site     | The Airy Loft                                    | hard       | 42–43 | `images/scenarios/page_22.png` |
| 15  | The Old Factory Site     | The Cozy Beer Garden                             | hard       | 44–45 | `images/scenarios/page_23.png` |
| 16  | Call of the Sea          | The Mysterious Aristocrat                        | hard       | 48–49 | `images/scenarios/page_25.png` |
| 17  | Call of the Sea          | The Lonely Watchtower                            | hard       | 50–51 | `images/scenarios/page_26.png` |
| 18  | Call of the Sea          | The Dreamy Yacht                                 | hard       | 52–53 | `images/scenarios/page_27.png` |
| 19  | A Sandbox Love Affair    | The Chaotic Kindergarten                         | medium     | 56–57 | `images/scenarios/page_29.png` |
| 20  | A Sandbox Love Affair    | Photo Studio "Freespace"                         | medium     | 58–59 | `images/scenarios/page_30.png` |
| 21  | A Sandbox Love Affair    | The First Shared Apartment                       | medium     | 60–61 | `images/scenarios/page_31.png` |
| 22  | A Sandbox Love Affair    | The Single-Family House in the Countryside       | medium     | 62–63 | `images/scenarios/page_32.png` |
| 23  | A Sandbox Love Affair    | The Enchanted Greenhouse                         | hard       | 64–65 | `images/scenarios/page_33.png` |
| 24  | A Sandbox Love Affair    | The Angled Attic Apartment                       | hard       | 66–67 | `images/scenarios/page_34.png` |
| 25  | A Sandbox Love Affair    | The Lake House                                   | hard       | 68–69 | `images/scenarios/page_35.png` |

> Page image numbers above are the PNGs rendered from the Spiralbuch PDF (each PDF
> page is a 2-page spread, so the spread containing scenario *n* is what is linked).

---

## Conventions used below

- **Floor plan:** see linked page image. The predetermined drawing inside the grid
  (walls, trees, roads, water, columns, doors) must be reproduced on the player
  sheet before play begins.
- **Rooms:** Roman numeral (room slot I–V), name, and the furniture-card numbers
  belonging to that room.
- **Furniture markers:** unless noted otherwise, place 1 marker per listed number on
  setup. Where a scenario says e.g. "place 3 markers" on a single card, that is
  called out in Special rules.
- **Bonus points / Special rules:** quoted in compressed form from the mission.

---

## Training Scenario — 1 Room, Kitchen, Bathroom
*Page image: `images/scenarios/page_03.png`*

The student furnishes their very first tiny apartment. Predetermined floor plan: a
6-square-wide square outline on the grid (see image).

| Slot | Room        | Furniture card numbers |
|------|-------------|------------------------|
| I    | Living room | 2, 15, 19              |
| II   | Kitchen     | 5, 7                   |
| III  | Bathroom    | 8, 9, 10               |

**Bonus points**
- +3 — Bathroom is fully furnished (8, 9, 10).

**Tips (informational, not scored)**
- Overlap open spaces to save grid.
- Keep walkways accessible.
- Don't forget the hallway connecting all rooms.
- A fully furnished room earns its walls (room does not need to be rectangular).
- Drop a piece that costs more points than it gains.

---

## Soaring High

> Setting: the town council of St. Pöppeln wants to turn a sleepy mountain village
> into a wellness destination.

### 1 · The Alpine Wellness Hut · *easy*
*Page image: `images/scenarios/page_05.png`*

A spacious mountain hut, with kitchen, communal dorm and wellness oasis.

| Slot | Room          | Furniture card numbers          |
|------|---------------|---------------------------------|
| I    | Kitchen       | 4, 7, 20                        |
| II   | Dormitory     | 12, 13                          |
| III  | Wellness oasis| 8, 9, 10, 11, 18, 21, 31        |

**Bonus points**
- +5 — At least 1 piece of furniture from every furniture card is placed.

### 2 · The Mountain Surgery · *easy*
*Page image: `images/scenarios/page_06.png`*

A forest-house practice for a renowned psychologist: home office, waiting room,
reception.

| Slot | Room         | Furniture card numbers          |
|------|--------------|---------------------------------|
| I    | Home office  | 16, 18, 21, 24, 31, 32, 33      |
| II   | Waiting room | 1, 19                           |
| III  | Reception    | 3, 17                           |

**Special rules**
- Do not place a carpet on the front porch.

**Bonus points**
- +10 — All home-office furniture is installed at least once.
- +3  — Waiting room has a maximum of 2 doors and is square.
- +3  — Reception has a north-facing window.

### 3 · "Castle Café" · *easy*
*Page image: `images/scenarios/page_07.png`*

Castle with two turrets becomes a café with kitchen+storage, guest restroom and
dining area for 16+.

| Slot | Room           | Furniture card numbers |
|------|----------------|------------------------|
| I    | Kitchen        | 3, 7                   |
| II   | Guest restroom | 8, 9                   |
| III  | Dining area    | 4, 5, 19, 30           |

**Special rules**
- No hallway; all rooms connect directly to the dining area.

**Bonus points**
- +5 — Dining area has at least 16 chairs.
- +5 — At least one toilet (8) and one sink (9) installed.
- +3 — 2 shelves (3) installed.
- +5 — Counter (30) installed.
- +1 — Per table that has at least one plant adjacent to it.

---

## The Fantasy Fan

> Setting: superfan Benni Beutler chases adventure across his life.

### 4 · The Rehearsal Room in the Old Barn · *easy*
*Page image: `images/scenarios/page_09.png`*

Band rehearsal room behind a rusted gate.

| Slot | Room            | Furniture card numbers                          |
|------|-----------------|-------------------------------------------------|
| I    | Rehearsal room  | 7, 15, 17, 20, 21, 27, 28, 29, 33               |

**Special rules**
- Exit: 2 squares wide, drawn at any time (see floor plan).
- Both 17 (instruments) and 27 (mic) must be drawn the same way.
- Do not place furniture on the carpet.

**Bonus points**
- +2 — Each musical instrument is at most 2 squares away from mic (27) and amp (28).
- +3 — Carpet (33) placed.

### 5 · The Game Store in the Old Town · *easy*
*Page image: `images/scenarios/page_10.png`*

A rented retail space turned board-game store, with a big shop window.

| Slot | Room      | Furniture card numbers                  |
|------|-----------|-----------------------------------------|
| I    | Salesroom | 3, 4, 5, 15, 20, 23, 30, 33             |

**Special rules**
- Counter (30) covers the front of the shop window — connection to the internet.
- No hallway.
- The walkable area between counter and shop window must be reachable by customers.
- Do not place furniture on the carpet.

**Bonus points**
- +5 — 5 shelves (3) placed.
- +5 — Counter (30) covers the front of the shop window.
- +3 — Children's toys (23) installed.
- +3 — Carpet (33) placed.

### 6 · Beutler's End · *medium*
*Page image: `images/scenarios/page_11.png`*

A completely underground "mancave" with many small interconnected rooms in
rounded shapes.

| Slot | Room    | Furniture card numbers                                                 |
|------|---------|------------------------------------------------------------------------|
| I    | Mancave | 1, 4, 7, 13, 14, 19, 21, 23, 24, 25, 27, 29, 31                        |

**Special rules**
- No hallway; the mancave directly connects to the bathroom only.

**Bonus points**
- +5 — TVs (29) are at least 6 squares apart.
- +5 — Small kitchen (7) and large table (4) are at most 4 squares apart.
- +5 — Small bed (13) and large fridge (14) are at most 4 squares apart.
- +5 — Lounge furniture (21) and fireplace (31) are at most 4 squares apart.

---

## Club Life

> Setting: the Neustadt campsite renovates after a fire.

### 7 · The Renovated Clubhouse · *medium*
*Page image: `images/scenarios/page_13.png`*

The "Neustadt Socks e.V." clubhouse, freshly patched up after a fire.

| Slot | Room      | Furniture card numbers                          |
|------|-----------|-------------------------------------------------|
| I    | Clubroom  | 5, 7, 20, 21, 22, 25, 28, 30                    |

**Special rules**
- Around 10 of the 16 walkable border squares of the building are charred (see floor
  plan). Furniture may not be placed on the charred squares, and they are not part of
  any room. Walls may be drawn through them. The "abstrahlend" / radiating side may
  not bound a room (per page image).

**Bonus points**
- +3 — Front door faces north.
- +5 — All hobby equipment (25) installed.
- +3 — Counter (30) is at most 2 squares from the front door.

### 8 · The Eccentric Small Animal Breeder · *medium*
*Page image: `images/scenarios/page_14.png`*

Kurt Kleinviech's animal-breeding house, with a dedicated animal room.

| Slot | Room               | Furniture card numbers          |
|------|--------------------|---------------------------------|
| I    | Animal room        | 15, 22, 24, 33                  |
| II   | Bedroom            | 13, 14                          |
| III  | Bathroom           | 8, 9, 11                        |
| IV   | Living/dining room | 4, 7, 19, 27                    |

**Special rules**
- Place 3 markers on furniture card 24 (pet supplies).
- Do not place furniture on the carpet.

**Bonus points**
- +5 — Pet supplies (24) installed 3 times.
- +3 — Per room with a rectangular floor plan.
- +3 — Living/dining room has a south-facing window.
- +4 — Carpet (33) placed.

### 9 · Tiny Houses · *medium*
*Page image: `images/scenarios/page_15.png`*

Three "tiny houses" on the campsite, identical footprint, identical furnishings.

| Slot | Room                  | Furniture card numbers                  |
|------|-----------------------|-----------------------------------------|
| I    | 3 × Living/dining     | 5, 7, 12, 19, 20, 21, 29                |
| II   | 3 × Bathroom          | 8, 9, 10                                |

**Special rules**
- All three Tiny Houses get the same furnishings; no overlap and no expansion of the
  footprint. Each house has a different floor plan (drawn on the player sheet) but
  identical occupation by furniture.

**Bonus points**
- +5 — All front doors point in the same direction.
- +5 — The three houses are furnished identically.
- +5 — In each house, the bathroom (8) sits adjacent to the small kitchen (7).

---

## A Story of Success

> Setting: tech-genius Alex Xander's stellar startup arc.

### 10 · Startup Tower · *medium*
*Page image: `images/scenarios/page_17.png`*

Old water tower → startup HQ. Two load-bearing walls and a stair in the east are
predetermined.

| Slot | Room            | Furniture card numbers          |
|------|-----------------|---------------------------------|
| I    | CEO's office    | 2, 16                           |
| II   | Bathroom        | 8, 9                            |
| III  | Conference room | 4, 7, 19, 29                    |
| IV   | Office space    | 17, 24, 26                      |

**Special rules**
- No hallway; all rooms connect to the office space.

**Bonus points**
- +5 — Office space has a west-facing window.
- +5 — At least 5 small desks (17) in the office space.
- +3 — CEO's office has a window facing the conference room.
- +3 — Sports device (26) installed.

### 11 · The State-of-the-Art Villa · *medium*
*Page image: `images/scenarios/page_18.png`*

Square-room villa with wellness area and large living/dining area.

| Slot | Room               | Furniture card numbers                  |
|------|--------------------|-----------------------------------------|
| I    | Home office        | 15, 17                                  |
| II   | Bathroom           | 8, 9, 11, 19                            |
| III  | Kitchen            | 6, 14                                   |
| IV   | Living/dining area | 4, 20, 26, 29, 32                       |

**Special rules**
- The home office must have a window from which the tower can be seen.

**Bonus points**
- +3 — Home office has a north-facing window.
- +5 — Per room with a square footprint.
- +3 — Per room with a rectangular (but not square) footprint.
- +3 — Wellness area (11) installed.
- +3 — 2 pieces of art (32) displayed.

### 12 · Shared Apartment with Good Connections · *medium*
*Page image: `images/scenarios/page_19.png`*

Shared apartment for two singles and a couple; busy street to the south.

| Slot | Room               | Furniture card numbers          |
|------|--------------------|---------------------------------|
| I    | Room 1             | 13, 23                          |
| II   | Room 2             | 3, 13, 17                       |
| III  | Room 3             | 12, 15                          |
| IV   | Bathroom           | 8, 9, 10                        |
| V    | Living/dining room | 4, 7, 29                        |

**Bonus points**
- +3 — Rooms 1 and 2 are the same size and have the same number of squares (they
  don't need to be the same shape).
- +3 — Room 3 is bigger than rooms 1 and 2.
- +3 — Per room with a rectangular floor plan.
- +8 — Rooms 1, 2 and 3 are completely furnished.
- +5 — Rooms 1, 2 and 3 do not touch the southern wall of the building.

---

## The Old Factory Site

> Setting: heiress Sandra Schaumberger rebuilds the bankrupt family brewery into a
> trendy scene district.

### 13 · The Forgotten Railway Wagon · *hard*
*Page image: `images/scenarios/page_21.png`*

A decommissioned railway wagon turned holiday rental with industrial chic.

| Slot | Room               | Furniture card numbers                          |
|------|--------------------|-------------------------------------------------|
| I    | Bathroom           | 8, 9, 10                                        |
| II   | Living/dining room | 3, 5, 7, 13, 15, 16, 19, 20, 27, 32             |

**Special rules**
- Walls of the wagon (page image, Seite 41) are fixed — only the marked side allows
  drawing the front door.
- The wagon may be entered from any of the four predetermined doors.

**Bonus points**
- +3 — The two small tables (5, 7) are at most 2 squares apart.
- +3 — The large bed (13) and large desk (16) are at most 3 squares apart.
- +2 — The long table (16) is positioned along an exterior wall.
- +3 — Bathroom is rectangular.

### 14 · The Airy Loft · *hard*
*Page image: `images/scenarios/page_22.png`*

Open-space loft with three irregularly placed load-bearing columns.

| Slot | Room               | Furniture card numbers                                      |
|------|--------------------|-------------------------------------------------------------|
| I    | Living/dining room | 2, 4, 6, 15, 20, 24, 25, 26, 31, 32                         |

**Special rules**
- At the start of the game, you may draw three 1×1 columns onto the floor plan of
  the player to your right. They may go anywhere except onto already-drawn
  furniture/open spaces. Columns may not be built over.
- No hallway; the bathroom connects directly to the living/dining room.

**Bonus points**
- +5 — Big kitchen (6) and big table (4) are at most 4 squares apart.
- +5 — Pet accessories (24) and a small sofa (2) are at most 4 squares apart.
- +5 — 3 pieces of art (32) displayed.
- +3 — Fireplace (31) installed.

### 15 · The Cozy Beer Garden · *hard*
*Page image: `images/scenarios/page_23.png`*

Traditional beer garden under two old trees, with separate small kitchen and toilet
houses.

| Slot | Room          | Furniture card numbers                          |
|------|---------------|-------------------------------------------------|
| I    | Toilet house  | 8, 9                                            |
| II   | Kitchen house | 7                                               |
| III  | Garden        | 4, 5, 21, 23, 27                                |

**Special rules**
- At game start, you may draw a 2×2 storage hut anywhere on the floor plan of the
  player to your right.
- No hallway; the small houses connect directly to the garden.
- You may draw a small kitchen house of any size at any location.
- You may draw a small toilet house of any size at any location.
- You may draw 4 entrance doors at any time.

**Bonus points**
- +5 — At least 15 seats in the garden.
- +3 — The beer garden has accessibility from every direction (front doors).
- +3 — The musical instrument (27) is adjacent to a tree.
- +2 — Toilet house does not border the kitchen house.
- +2 — Per tree that is surrounded on at least 6 squares (border on at least 6 of
  the 8 surrounding squares) by furniture or open spaces.

---

## Call of the Sea

> Setting: the stormy coast of Bluewater Bay — an old manor house on one side, a
> lighthouse on the other.

### 16 · The Mysterious Aristocrat · *hard*
*Page image: `images/scenarios/page_25.png`*

Solitary art collector's house with a *secret room* hidden behind a sliding mirror.

| Slot | Room               | Furniture card numbers                  |
|------|--------------------|-----------------------------------------|
| I    | Bedroom            | 13, 17, 20                              |
| II   | Bathroom           | 8, 9, 10                                |
| III  | Living/dining room | 4, 15, 31, 32                           |

**Special rules**
- The secret room is 2×2. It is reached by a secret passage 1 square wide and any
  length ≥ 1, with at most one 90° turn.
- The secret passage must end inside a room or the hallway. At its end stands a
  large mirrored cabinet with the marked open spaces; you decide whether it slides
  left or right.
- Neither the secret room nor the secret passage may touch an exterior wall, and
  neither may contain furniture.
- The secret room, the secret passage and the mirrored cabinet may each be drawn
  at any time, even only partially at first.

**Bonus points**
- +2 — Per square that is part of the secret passage or the secret room.
- +2 — Per piece of art (32) displayed.
- +3 — Fireplace (31) installed.

### 17 · The Lonely Watchtower · *hard*
*Page image: `images/scenarios/page_26.png`*

A slanted lighthouse — three levels connected by an external stair. No interior
separation walls. The floor plan has three vertical bands: Ground floor, Upper floor,
Top floor.

| Slot | Room                | Furniture card numbers                                              |
|------|---------------------|---------------------------------------------------------------------|
| I    | Bathroom            | 8, 9, 10                                                            |
| II   | Living/dining area  | 2, 3, 5, 7, 13, 15, 19, 21, 25, 29, 31                              |

**Special rules**
- No interior dividing walls — the keeper wants a cozy single living area across all
  three floors. Only the bathroom is its own room.

**Bonus points**
- +5 — There is a television (29) on each floor.
- +5 — The small kitchen (7) and small table (5) are on the same floor.
- +5 — The small bed (13) and small wardrobe (15) are on the same floor.
- +5 — The small sofa (2) and fireplace (31) are on the same floor.
- +2 — Per open space in front of a specified window.

### 18 · The Dreamy Yacht · *hard*
*Page image: `images/scenarios/page_27.png`*

A small yacht being outfitted for a Mediterranean trip. Lower deck + upper deck on
the floor plan. One broken window must be boarded up.

| Slot | Room        | Furniture card numbers          |
|------|-------------|---------------------------------|
| I    | Berth       | 13, 15                          |
| II   | Galley      | 5, 7                            |
| III  | Bathroom    | 8, 9, 10                        |
| IV   | Lounge      | 1, 4, 14, 19, 29                |

**Special rules**
- No hallway. The marked "S" square on the upper deck is the stairwell, occupying
  1 square and walkable.
- The berth must be positioned at the bow.
- One of the broken windows must be boarded up (drawn over).
- A door connects each deck to the stairwell; otherwise floors are not connected
  except via S.

**Bonus points**
- +5 — Per room with at least one window.
- +5 — Stairwell S is located in the berth.
- +5 — A large wardrobe (14) and a large table (4) are both installed on the upper
  deck.

---

## A Sandbox Love Affair

> Setting: follow Paul and Paula across an entire life together.

### 19 · The Chaotic Kindergarten · *medium*
*Page image: `images/scenarios/page_29.png`*

Paul and Paula meet in kindergarten — kitchen + big group room.

| Slot | Room       | Furniture card numbers                  |
|------|------------|-----------------------------------------|
| I    | Kitchen    | 4, 6                                    |
| II   | Group room | 2, 5, 15, 21, 22, 23, 33                |

**Special rules**
- Place 4 markers on furniture card 23 (children's toys).
- Do not place furniture on the carpet.

**Bonus points**
- +5 — Kitchen has a window with a view of a tree.
- +5 — Both variants of children's toy (23) are installed.
- +5 — Carpet (33) placed.
- +5 — Every piece of furniture in the group room is installed at least once.

### 20 · Photo Studio "Freespace" · *medium*
*Page image: `images/scenarios/page_30.png`*

Teenage Paul redecorates a photo studio — open shooting space.

| Slot | Room         | Furniture card numbers                          |
|------|--------------|-------------------------------------------------|
| I    | Photo studio | 1, 3, 7, 17, 20, 23, 24, 26, 27, 32             |

**Special rules**
- At the start of the game, you may draw free-space marks on the floor plan of the
  player to your right (locations of your choice).
- No hallway.

**Bonus points**
- +3 — Open space at least 3 squares wide that connects two exterior walls.
- +3 — For each open space adjacent to a corner of the interior wall.

### 21 · The First Shared Apartment · *medium*
*Page image: `images/scenarios/page_31.png`*

Paul and Paula's first place together. South-facing trees they want to see.

| Slot | Room        | Furniture card numbers          |
|------|-------------|---------------------------------|
| I    | Kitchen     | 6, 12                           |
| II   | Living room | 1, 3, 19                        |
| III  | Dining room | 5, 19                           |
| IV   | Bathroom    | 8, 9, 10                        |
| V    | Bedroom     | 12, 14                          |

**Bonus points**
- +5 — Dining room has a window with a view of a tree.
- +5 — Bedroom has a window with a view of a tree.
- +5 — Kitchen is at least 15 squares in size.
- +2 — In the living room, there are plants on at least 4 squares.
- +5 — Bathroom is fully furnished (8, 9, 10).

### 22 · The Single-Family House in the Countryside · *medium*
*Page image: `images/scenarios/page_32.png`*

Family grown. Two children, one on the way. Equal-sized children's rooms; tree view.

| Slot | Room                   | Furniture card numbers          |
|------|------------------------|---------------------------------|
| I    | Children's bedroom 1   | 1, 13, 22                       |
| II   | Children's bedroom 2   | 13, 17, 23                      |
| III  | Bedroom                | 12, 15                          |
| IV   | Bathroom               | 8, 9, 10                        |
| V    | Living/dining room     | 4, 6, 20, 24                    |

**Bonus points**
- +5 — Children's bedrooms 1 and 2 have the same size.
- +5 — Bedroom has a window with a view of a tree.
- +5 — Baby equipment (22, 23) installed.

### 23 · The Enchanted Greenhouse · *hard*
*Page image: `images/scenarios/page_33.png`*

Paula's greenhouse for her gardening passion — also kid-friendly + pet-friendly.

| Slot | Room       | Furniture card numbers                          |
|------|------------|-------------------------------------------------|
| I    | Greenhouse | 13, 18, 19, 21, 23, 24, 26                      |

**Special rules**
- Plants (18, 19) may also be drawn on open spaces of other furniture and have to be
  drawn as connected colonies. Open-space rule applies as normal otherwise.
- No hallway.

**Bonus points**
- +3 — Per plant colony (1 or more 18/19 connected); see floor plan for examples.

### 24 · The Angled Attic Apartment · *hard*
*Page image: `images/scenarios/page_34.png`*

Bert moves out — attic apartment with low sloping ceilings (you can put furniture
under them but can't stand upright).

| Slot | Room               | Furniture card numbers          |
|------|--------------------|---------------------------------|
| I    | Balcony            | 5, 19, 21                       |
| II   | Kitchen            | 7, 15                           |
| III  | Living/dining room | 2, 4, 15, 20, 29, 31, 32        |
| IV   | Bathroom           | 8, 9, 10                        |
| V    | Bedroom            | 3, 12                           |

**Special rules**
- No hallway; all rooms connect to the living/dining room only.
- The marked low-ceiling area (page image) may contain furniture but no walking
  path may go through it (i.e. cannot be used as a corridor).
- The balcony is treated as a room (a small balcony railing is placed where marked).

**Bonus points**
- +2 — Balcony railing (small balcony marker 5) placed.
- +5 — Fireplace (31) installed.
- +3 — 2 pieces of art (32) displayed.

### 25 · The Lake House · *hard*
*Page image: `images/scenarios/page_35.png`*

The retirement lake house. Two guest rooms for visiting grandchildren and a big
living/dining room for family festivities.

| Slot | Room                | Furniture card numbers          |
|------|---------------------|---------------------------------|
| I    | Living/dining room  | 1, 4, 6, 15, 19, 32             |
| II   | Bedroom             | 12, 15                          |
| III  | Guest room I        | 20, 21, 23                      |
| IV   | Guest room II       | 13, 22                          |
| V    | Bathroom            | 8, 9, 10, 11                    |

**Bonus points**
- +3 — Living/dining room has a window with a view of the lake.
- +3 — Living/dining room is at least 35 squares in size.
- +2 — Per piece of art (32) displayed.
- +3 — Per bedroom and guest room that has at least one square adjacent to the
  bathroom.

---

## Closing note

*"Enjoy furnishing!"* — `images/scenarios/page_36.png`

---

## Bonus — Expansion Scenario: 2023 Essen Spiel  *(workshop content)*

> **Not in the original PDFs.** This scenario was found inside the Steam Workshop
> mod (id `3429711308`, Chinese localisation by *怡居巧匠*). Treat it as
> community / promo content; it appears to be the publisher's Essen Spiel 2023
> promo translated into Chinese. Verify wording against the image before relying
> on it.
>
> - Floor plan image: `images/cards/bonus_scenario_floorplan.jpg`
> - Rooms / bonus / special-rules image: `images/cards/bonus_scenario_rules.jpg`

**Premise (paraphrased).** Two super-fans of the Essen Spiel boardgame fair (Julia
and Ulrich) renovate their home into a miniature Essen exhibition hall — five
rooms plus a separate storage room (an extra furniture-overflow area).

**Floor plan.** The predetermined outline traces a small Essen-hall silhouette
with two entrances marked: **west entrance (西入口)** and **south entrance
(南入口)**. A small storage room (储藏室) sits off to the side; see image.

**Rooms (best-effort read from the image — verify before coding).**

| Slot | Room                  | Furniture card numbers (best read)        |
|------|-----------------------|-------------------------------------------|
| I    | 游戏室 Game room      | 1, 4, 19, 20                              |
| II   | 起居室 Living room    | 1, 7, 19, 22, 30                          |
| III  | 厨房 Kitchen          | 5, 6, 19, …                               |
| IV   | 卧室 Bedroom          | 12, 17, 19, 31, …                         |
| V    | 盥洗室 Bathroom       | 8, 9, 10, 11                              |

**Bonus points**
- +1 — per door (including the front door).

**Special rules (paraphrased from the image — verify the Chinese text).**
- Rooms do **not** all need direct hallway connection; the usual hallway rule is
  relaxed (rooms may connect via other rooms).
- All furniture positions in this scenario are predetermined. For pieces that
  are mirror-symmetric, only one of the two valid placements counts.
- All other regular rules apply: rooms can connect to several rooms; walls still
  need to be drawn around them.
- The extra storage room can absorb pieces you don't want to install in any of
  the 5 rooms — pieces placed there do not contribute room points but still
  fulfil the "this furniture was installed" condition. Extra ad-hoc furniture
  may be drawn into the storage room.

