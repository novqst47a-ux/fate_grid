import { CharacterNode, Link, Emotion } from '../types';
import { manhattanDistance, isInRange } from './distance';

const PREVIEW_MAX = 6;

export interface PreviewCandidate {
  nodeId: string;
  x: number;
  y: number;
  emotion: Emotion;
  weight: number;
}

function previewPositionWeight(
  attackerPosition: string,
  target: CharacterNode,
): number {
  let base = 1;
  if (target.position === 'PROTAG') base *= 1.5;
  if (attackerPosition === 'RIVAL' && target.position === 'PROTAG') base *= 4;
  if (attackerPosition === 'RIVAL' && target.position === 'SUPPORT') base *= 1.5;
  return base;
}

function likelyEmotion(position: string): Emotion {
  if (position === 'VILLAIN') return 'Hostile';
  if (position === 'RIVAL') return 'Hostile';
  if (position === 'MENTOR') return 'Friendly';
  if (position === 'SUPPORT') return 'Friendly';
  return 'Awkward';
}

/**
 * Compute preview link candidates for a card being placed at (hoverX, hoverY).
 * Returns at most PREVIEW_MAX candidates sorted by weight descending.
 */
export function computePreviewLinks(
  hoverX: number,
  hoverY: number,
  nextCardPosition: string,
  range: number,
  existingNodes: CharacterNode[],
  _existingLinks: Link[],
): PreviewCandidate[] {
  const candidates: PreviewCandidate[] = [];

  for (const node of existingNodes) {
    const dist = manhattanDistance(hoverX, hoverY, node.x, node.y);
    if (!isInRange(range, dist)) continue;

    const w =
      dist === 0
        ? 1
        : (1 / dist) * previewPositionWeight(nextCardPosition, node);

    candidates.push({
      nodeId: node.id,
      x: node.x,
      y: node.y,
      emotion: likelyEmotion(nextCardPosition),
      weight: w,
    });
  }

  candidates.sort((a, b) => b.weight - a.weight);
  return candidates.slice(0, PREVIEW_MAX);
}
