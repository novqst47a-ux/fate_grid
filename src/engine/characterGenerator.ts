import { Position, Personality, CharacterNode } from '../types';

// ─── Position base stats ──────────────────────────────────────────────────────

interface PositionStats {
  rangeMin: number;
  rangeMax: number;
  slotsMin: number;
  slotsMax: number;
}

const POSITION_STATS: Record<Position, PositionStats> = {
  PROTAG:  { rangeMin: 999, rangeMax: 999, slotsMin: 5, slotsMax: 7 },
  SUPPORT: { rangeMin: 3,   rangeMax: 4,   slotsMin: 2, slotsMax: 3 },
  RIVAL:   { rangeMin: 999, rangeMax: 999, slotsMin: 3, slotsMax: 5 },
  VILLAIN: { rangeMin: 999, rangeMax: 999, slotsMin: 4, slotsMax: 6 },
  MENTOR:  { rangeMin: 5,   rangeMax: 5,   slotsMin: 2, slotsMax: 2 },
  EXTRA:   { rangeMin: 1,   rangeMax: 2,   slotsMin: 1, slotsMax: 1 },
};

// ─── Personality modifiers ────────────────────────────────────────────────────

interface PersonalityModifier {
  range: number;
  slots: number;
}

export const PERSONALITY_MODIFIERS: Record<Personality, PersonalityModifier> = {
  SOCIAL:     { range: +1, slots: +2 },
  BRIGHT:     { range:  0, slots: +1 },
  INTRO:      { range: -1, slots: -1 },
  CYNICAL:    { range:  0, slots:  0 },
  MAD:        { range: +1, slots: +1 },
  CALM:       { range:  0, slots: -1 },
  AGGRESSIVE: { range: +2, slots: +1 },
  TIMID:      { range: -2, slots: -2 },
};

// ─── Calculation ──────────────────────────────────────────────────────────────

export function calculateStats(
  position: Position,
  personality: Personality,
  rng: () => number,
): { range: number; slots: number } {
  const stats = POSITION_STATS[position];
  const mod = PERSONALITY_MODIFIERS[personality];

  const baseRange =
    stats.rangeMin === stats.rangeMax
      ? stats.rangeMin
      : stats.rangeMin + Math.floor(rng() * (stats.rangeMax - stats.rangeMin + 1));

  const baseSlots =
    stats.slotsMin === stats.slotsMax
      ? stats.slotsMin
      : stats.slotsMin + Math.floor(rng() * (stats.slotsMax - stats.slotsMin + 1));

  // Range 999 (∞) is unaffected by personality modifiers
  const finalRange = baseRange >= 999 ? 999 : Math.max(1, baseRange + mod.range);
  const finalSlots = Math.max(1, baseSlots + mod.slots);

  return { range: finalRange, slots: finalSlots };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createCharacterNode(
  id: string,
  name: string,
  position: Position,
  personality: Personality,
  x: number,
  y: number,
  rng: () => number,
  placementIndex = 0,
): CharacterNode {
  const { range, slots } = calculateStats(position, personality, rng);
  return { id, name, position, personality, range, slots, slotsRemaining: slots, x, y, placementIndex };
}

// ─── Next card generation ─────────────────────────────────────────────────────

/**
 * Weighted position pool. EXTRA is intentionally low (~10%) so that
 * roughly 2–3 EXTRAs appear across the full 26 user-placed cards.
 * Weights: SUPPORT=30, RIVAL=25, VILLAIN=20, MENTOR=20, EXTRA=10 → total=105
 * EXTRA share ≈ 10/105 ≈ 9.5 %
 */
const CARD_POSITION_WEIGHTS: [Position, number][] = [
  ['SUPPORT', 30],
  ['RIVAL', 25],
  ['VILLAIN', 20],
  ['MENTOR', 20],
  ['EXTRA', 10],
];
const CARD_POSITION_TOTAL = CARD_POSITION_WEIGHTS.reduce((s, [, w]) => s + w, 0);

const CARD_PERSONALITIES: Personality[] = [
  'SOCIAL', 'BRIGHT', 'INTRO', 'CYNICAL', 'MAD', 'CALM', 'AGGRESSIVE', 'TIMID',
];

export function generateNextCard(
  rng: () => number,
): { position: Position; personality: Personality } {
  let rand = rng() * CARD_POSITION_TOTAL;
  let position: Position = CARD_POSITION_WEIGHTS[0][0];
  for (const [pos, weight] of CARD_POSITION_WEIGHTS) {
    rand -= weight;
    if (rand <= 0) { position = pos; break; }
  }
  const personality = CARD_PERSONALITIES[Math.floor(rng() * CARD_PERSONALITIES.length)];
  return { position, personality };
}
