import { describe, it, expect } from 'vitest';
import {
  calculateStats,
  createCharacterNode,
  generateNextCard,
  PERSONALITY_MODIFIERS,
} from '../characterGenerator';
import { createRNG } from '../rng';
import { Position, Personality } from '../../types';

// Deterministic RNG for tests
const rng = createRNG(42);

describe('calculateStats', () => {
  it('PROTAG always has infinite range (999)', () => {
    const personalities: Personality[] = ['SOCIAL', 'AGGRESSIVE', 'TIMID', 'INTRO'];
    for (const p of personalities) {
      const { range } = calculateStats('PROTAG', p, createRNG(1));
      expect(range).toBe(999);
    }
  });

  it('RIVAL always has infinite range', () => {
    const { range } = calculateStats('RIVAL', 'TIMID', createRNG(1));
    expect(range).toBe(999);
  });

  it('VILLAIN always has infinite range', () => {
    const { range } = calculateStats('VILLAIN', 'TIMID', createRNG(1));
    expect(range).toBe(999);
  });

  it('EXTRA has range 1 or 2 (before personality modifier)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const r = createRNG(seed);
      const { range } = calculateStats('EXTRA', 'CYNICAL', r); // CYNICAL = 0 modifier
      expect(range).toBeGreaterThanOrEqual(1);
      expect(range).toBeLessThanOrEqual(2);
    }
  });

  it('MENTOR has fixed range 5 (CYNICAL personality, 0 modifier)', () => {
    const { range } = calculateStats('MENTOR', 'CYNICAL', createRNG(0));
    expect(range).toBe(5);
  });

  it('MENTOR + SOCIAL (range +1) = 6', () => {
    const { range } = calculateStats('MENTOR', 'SOCIAL', createRNG(0));
    expect(range).toBe(6);
  });

  it('MENTOR + INTRO (range -1) = 4', () => {
    const { range } = calculateStats('MENTOR', 'INTRO', createRNG(0));
    expect(range).toBe(4);
  });

  it('MENTOR + TIMID (range -2) = clamped to minimum 3', () => {
    const { range } = calculateStats('MENTOR', 'TIMID', createRNG(0));
    expect(range).toBe(Math.max(1, 5 - 2));
  });

  it('Final range is never below 1', () => {
    // EXTRA (range 1-2) + TIMID (-2) → min 1
    for (let seed = 0; seed < 50; seed++) {
      const { range } = calculateStats('EXTRA', 'TIMID', createRNG(seed));
      expect(range).toBeGreaterThanOrEqual(1);
    }
  });

  it('Final slots are never below 1', () => {
    // EXTRA (slots 1) + TIMID (-2) → clamped to 1
    for (let seed = 0; seed < 50; seed++) {
      const { slots } = calculateStats('EXTRA', 'TIMID', createRNG(seed));
      expect(slots).toBeGreaterThanOrEqual(1);
    }
  });

  it('SUPPORT + SOCIAL adds +2 slots', () => {
    // SUPPORT base slots: 2-3; SOCIAL +2 → 4-5
    const results: number[] = [];
    for (let seed = 0; seed < 30; seed++) {
      const { slots } = calculateStats('SUPPORT', 'SOCIAL', createRNG(seed));
      results.push(slots);
    }
    expect(results.every((s) => s >= 4 && s <= 5)).toBe(true);
  });

  it('personality modifiers match expected values', () => {
    expect(PERSONALITY_MODIFIERS.SOCIAL).toEqual({ range: 1, slots: 2 });
    expect(PERSONALITY_MODIFIERS.TIMID).toEqual({ range: -2, slots: -2 });
    expect(PERSONALITY_MODIFIERS.AGGRESSIVE).toEqual({ range: 2, slots: 1 });
    expect(PERSONALITY_MODIFIERS.CALM).toEqual({ range: 0, slots: -1 });
  });
});

describe('createCharacterNode', () => {
  it('creates a node with correct coordinates', () => {
    const node = createCharacterNode('id1', 'Alice', 'PROTAG', 'BRIGHT', 3, -2, rng);
    expect(node.x).toBe(3);
    expect(node.y).toBe(-2);
    expect(node.name).toBe('Alice');
    expect(node.position).toBe('PROTAG');
    expect(node.personality).toBe('BRIGHT');
  });

  it('initialises slotsRemaining equal to slots', () => {
    const node = createCharacterNode('id2', 'Bob', 'SUPPORT', 'CALM', 0, 0, createRNG(5));
    expect(node.slotsRemaining).toBe(node.slots);
  });
});

describe('generateNextCard', () => {
  it('never generates PROTAG as next card', () => {
    for (let seed = 0; seed < 100; seed++) {
      const { position } = generateNextCard(createRNG(seed));
      expect(position).not.toBe('PROTAG');
    }
  });

  it('generates valid position and personality', () => {
    const validPositions: Position[] = ['SUPPORT', 'RIVAL', 'VILLAIN', 'MENTOR', 'EXTRA'];
    const validPersonalities: Personality[] = [
      'SOCIAL', 'BRIGHT', 'INTRO', 'CYNICAL', 'MAD', 'CALM', 'AGGRESSIVE', 'TIMID',
    ];
    for (let seed = 0; seed < 50; seed++) {
      const card = generateNextCard(createRNG(seed));
      expect(validPositions).toContain(card.position);
      expect(validPersonalities).toContain(card.personality);
    }
  });
});
