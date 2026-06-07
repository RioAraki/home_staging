import { describe, it, expect } from 'vitest';
import { currentCardIndex, roomPhase } from '../assets/scripts/state/roomFlow';

describe('currentCardIndex', () => {
  it('starts at 0 when nothing is resolved', () => {
    expect(currentCardIndex(3, () => false)).toBe(0);
  });

  it('advances past leading resolved cards', () => {
    const resolved = new Set([0, 1]);
    expect(currentCardIndex(3, (i) => resolved.has(i))).toBe(2);
  });

  it('returns the first gap, not the count, when a later card is unresolved', () => {
    const resolved = new Set([0, 2]); // card 1 still open
    expect(currentCardIndex(3, (i) => resolved.has(i))).toBe(1);
  });

  it('returns count when every card is resolved', () => {
    expect(currentCardIndex(3, () => true)).toBe(3);
  });

  it('a 0-card room is immediately at the end', () => {
    expect(currentCardIndex(0, () => false)).toBe(0);
  });
});

describe('roomPhase', () => {
  it('is furniture while a current card remains', () => {
    expect(roomPhase(3, 0)).toBe('furniture');
    expect(roomPhase(3, 2)).toBe('furniture');
  });

  it('is construction once the pointer reaches the count', () => {
    expect(roomPhase(3, 3)).toBe('construction');
  });

  it('a 0-card room is in construction immediately', () => {
    expect(roomPhase(0, 0)).toBe('construction');
  });
});
