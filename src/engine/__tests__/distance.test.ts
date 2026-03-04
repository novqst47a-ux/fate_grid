import { describe, it, expect } from 'vitest';
import { manhattanDistance, isInRange } from '../distance';

describe('manhattanDistance', () => {
  it('returns 0 for same coordinates', () => {
    expect(manhattanDistance(0, 0, 0, 0)).toBe(0);
    expect(manhattanDistance(3, 4, 3, 4)).toBe(0);
  });

  it('computes horizontal distance', () => {
    expect(manhattanDistance(0, 0, 4, 0)).toBe(4);
    expect(manhattanDistance(4, 0, 0, 0)).toBe(4);
  });

  it('computes vertical distance', () => {
    expect(manhattanDistance(0, 0, 0, 3)).toBe(3);
  });

  it('computes diagonal (Manhattan, not Euclidean)', () => {
    expect(manhattanDistance(0, 0, 3, 4)).toBe(7);
    expect(manhattanDistance(-1, -1, 2, 3)).toBe(7);
  });
});

describe('isInRange', () => {
  it('always returns true for infinite range (999)', () => {
    expect(isInRange(999, 0)).toBe(true);
    expect(isInRange(999, 1000)).toBe(true);
  });

  it('returns true when distance <= range', () => {
    expect(isInRange(3, 3)).toBe(true);
    expect(isInRange(3, 2)).toBe(true);
    expect(isInRange(3, 0)).toBe(true);
  });

  it('returns false when distance > range', () => {
    expect(isInRange(3, 4)).toBe(false);
    expect(isInRange(1, 2)).toBe(false);
  });
});
