import { Emotion, EmotionSubCategories, CharacterNode } from '../types';

const EMOTIONS: Emotion[] = ['Love', 'Friendly', 'Hostile', 'Awkward'];

/** Returns per-emotion weights biased by the attacker/target positions. */
function getEmotionWeights(from: CharacterNode, to: CharacterNode): number[] {
  // [Love, Friendly, Hostile, Awkward]
  const w = [1, 3, 2, 2];

  if (from.position === 'VILLAIN' || to.position === 'VILLAIN') {
    w[2] *= 3;   // Hostile ↑
    w[0] *= 0.3; // Love ↓
  }
  if (from.position === 'RIVAL') {
    w[2] *= 2;   // Hostile ↑
    w[3] *= 1.5; // Awkward ↑
  }
  if (from.position === 'MENTOR') {
    w[1] *= 3;   // Friendly ↑
    w[0] *= 0.5; // Love ↓
  }
  if (from.position === 'SUPPORT') {
    w[1] *= 2;   // Friendly ↑
  }

  return w;
}

/** Weighted random selection among EMOTIONS, then a random sub-category. */
export function generateEmotion(
  from: CharacterNode,
  to: CharacterNode,
  rng: () => number,
): { emotion: Emotion; subCategory: string } {
  const weights = getEmotionWeights(from, to);
  const total = weights.reduce((a, b) => a + b, 0);

  let rand = rng() * total;
  let emotionIndex = weights.length - 1;
  for (let i = 0; i < weights.length; i++) {
    rand -= weights[i];
    if (rand <= 0) {
      emotionIndex = i;
      break;
    }
  }

  const emotion = EMOTIONS[emotionIndex];
  const subCats = EmotionSubCategories[emotion];
  const subCategory = subCats[Math.floor(rng() * subCats.length)];

  return { emotion, subCategory };
}
