# Card Collapse on Place — Design

Date: 2026-05-31
Status: Approved inline by user, no separate plan doc.
Scope: Minor UI tweak — placed furniture cards in the sidebar shrink to a
compact one-line bar; clicking the bar expands the card back to its full
form. Withdraw stays inside the expanded view.

## Behavior

| Card state | Today | After this change |
|---|---|---|
| Face-down (not revealed) | `down` button — just the number | unchanged |
| Revealed, not placed/skipped | `up` — options + skip btn | unchanged |
| Revealed, **placed** | `up` — options + placed badge + ↺ Withdraw | **NEW collapsed bar** by default; manual expand restores the `up` look (plus a ⌃ collapse-back button in header) |
| Skipped | `up` — options + skipped badge + ↺ Un-skip | unchanged |

The collapse/expand state is **ephemeral, per-card, not persisted**.

## State machine (Card.tsx)

```ts
const [manuallyExpanded, setManuallyExpanded] = useState(false);

// Re-collapse whenever the placed flag flips (handles both "placed for the
// first time" and "withdrew then re-placed the same card").
useEffect(() => { setManuallyExpanded(false); }, [placed]);
```

Effective render branch order:

1. `!revealed && !resolved` → existing down button
2. `placed && !manuallyExpanded` → **NEW** compact bar
3. `placed && manuallyExpanded` → existing up view + ⌃ collapse btn in header
4. `revealed && !placed` (skipped or selecting) → existing up view, unchanged

## Compact bar layout

Horizontal flex row, short row height (single line + small padding).
Content (English to match existing `placed` badge): `#5  placed  ⌄`.
Clicking anywhere on the bar calls `setManuallyExpanded(true)`. No
Withdraw button on the bar — withdraw lives in the expanded view to keep
single-click on the bar as a non-destructive expand affordance.

## Expanded view (after manual expand)

Same JSX as today's placed up-state, plus one new button in the header
row: a ⌃ icon (matching the room-level `.room-collapse-btn` pattern in
`RoomPanel.tsx`) that calls `setManuallyExpanded(false)`. Withdraw button,
options, badge — all unchanged.

## Files touched

- `app/src/components/Card.tsx` — add local state + useEffect, new branch
  for compact bar, ⌃ button in header when manuallyExpanded.
- `app/src/components/Card.css` — `.card.placed-bar` styles for the
  compact form (~10 lines). May also reuse `.room-collapse-btn` look —
  decide during implementation; minor cosmetic detail.

## Out of scope

- Animating the collapse/expand transition.
- Per-card persistent state (reload always starts collapsed if placed).
- Room-level collapse changes — that already auto-collapses on completion.
- Touching the store, persistence, or any audio behavior.
- Affecting cards in other rooms (`disabled` prop still propagates from
  RoomPanel's demolish-mode flag — unchanged).

## Open decisions resolved inline by user "ok"

- Bar does NOT carry the ↺ Withdraw button.
- Collapse-back icon is ⌃ (consistent with `RoomPanel` room collapse).
- Bar label uses English "placed" (matches existing badge wording).
