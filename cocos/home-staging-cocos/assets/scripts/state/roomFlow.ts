/**
 * Pure helpers for the sequential per-room card flow.
 *
 * The room presents its furniture cards one at a time, in `furniture_numbers`
 * order. A card is "resolved" once it has been placed or skipped. The current
 * card is the first unresolved one; when every card is resolved the room moves
 * from the 'furniture' phase to the 'construction' phase (walls/doors unlock).
 *
 * These are kept cc-free so they can be unit-tested without the engine; the
 * store derives current-card / phase from its placed/skipped sets via these.
 */

export type RoomPhase = 'furniture' | 'construction';

/**
 * Index of the first unresolved card in a room of `count` cards, or `count`
 * if every card is resolved. `resolved(i)` reports whether card i is
 * placed-or-skipped.
 */
export function currentCardIndex(count: number, resolved: (i: number) => boolean): number {
  for (let i = 0; i < count; i++) {
    if (!resolved(i)) return i;
  }
  return count;
}

/** A room is in 'construction' once its current-card pointer runs off the end. */
export function roomPhase(count: number, currentIdx: number): RoomPhase {
  return currentIdx >= count ? 'construction' : 'furniture';
}
