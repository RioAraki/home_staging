import { describe, it, expect } from 'vitest';
import { suppressOpenCellCheck } from '../assets/scripts/state/roomFlow';

describe('suppressOpenCellCheck', () => {
  it('does NOT suppress during the furniture phase (the regression)', () => {
    // Furniture not all placed → 'furniture' phase, but wallPhase still its
    // default 'walls'. The old guard (wallPhase === 'walls') wrongly suppressed
    // the trapped-furniture check here — exactly when furniture is placed.
    expect(suppressOpenCellCheck({
      roomPhase: 'furniture', wallPhase: 'walls',
      activeRoomSlot: 'I', hasDoorForActiveRoom: false,
    })).toBe(false);
  });

  it('suppresses while drawing walls during construction', () => {
    expect(suppressOpenCellCheck({
      roomPhase: 'construction', wallPhase: 'walls',
      activeRoomSlot: 'I', hasDoorForActiveRoom: false,
    })).toBe(true);
  });

  it('suppresses during door phase before the active room has a door', () => {
    expect(suppressOpenCellCheck({
      roomPhase: 'construction', wallPhase: 'door',
      activeRoomSlot: 'I', hasDoorForActiveRoom: false,
    })).toBe(true);
  });

  it('does NOT suppress once the active room has a door', () => {
    expect(suppressOpenCellCheck({
      roomPhase: 'construction', wallPhase: 'door',
      activeRoomSlot: 'I', hasDoorForActiveRoom: true,
    })).toBe(false);
  });

  it('does NOT suppress when no room is active (final 大门/结算 stage)', () => {
    expect(suppressOpenCellCheck({
      roomPhase: 'furniture', wallPhase: 'walls',
      activeRoomSlot: null, hasDoorForActiveRoom: false,
    })).toBe(false);
  });
});
