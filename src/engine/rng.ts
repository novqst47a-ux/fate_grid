/**
 * Mulberry32 seeded PRNG.
 * Returns a factory that creates an independent RNG from a given seed.
 */
export function createRNG(seed: number): () => number {
  let s = seed >>> 0;
  return (): number => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate a random integer seed. */
export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
