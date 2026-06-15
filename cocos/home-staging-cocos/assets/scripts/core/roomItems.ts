// One ordered list of a room's placeable items, unifying the two systems:
//   - named furniture  (room.furniture: string[])  — editor-authored levels
//   - numbered cards    (room.furniture_numbers: number[]) — the 27 book levels
//
// All flow code (current-card pointer, phase, selection, progress counts) routes
// through roomItems so it never has to special-case which system a room uses.
// A room with `furniture` (names) takes the named path; otherwise numbered.
// cc-free so it can be unit-tested without the engine.

export type RoomItem =
  | { kind: 'named'; name: string }
  | { kind: 'numbered'; number: number };

export interface RoomLike {
  furniture?: string[];
  furniture_numbers?: number[];
}

export function isNamedRoom(room: RoomLike): boolean {
  return Array.isArray(room.furniture) && room.furniture.length > 0;
}

export function roomItems(room: RoomLike): RoomItem[] {
  if (isNamedRoom(room)) {
    return room.furniture!.map((name) => ({ kind: 'named', name }));
  }
  return (room.furniture_numbers ?? []).map((number) => ({ kind: 'numbered', number }));
}

export function roomItemCount(room: RoomLike): number {
  return isNamedRoom(room) ? room.furniture!.length : (room.furniture_numbers ?? []).length;
}

export function roomItemAt(room: RoomLike, idx: number): RoomItem | null {
  const items = roomItems(room);
  return idx >= 0 && idx < items.length ? items[idx] : null;
}
