import { CharacterNode, Link } from '../types';
import { manhattanDistance, isInRange } from './distance';
import { generateEmotion } from './emotionGenerator';

let _linkCounter = 0;
function nextLinkId(): string {
  return `link_${Date.now()}_${++_linkCounter}`;
}

// ─── Position weight ──────────────────────────────────────────────────────────

function positionWeight(
  attacker: CharacterNode,
  target: CharacterNode,
  rng: () => number,
): number {
  let base = 1;
  if (target.position === 'PROTAG') base *= 1.5;
  if (attacker.position === 'RIVAL' && target.position === 'PROTAG') {
    base *= 3 + rng() * 2; // random 3–5
  }
  if (attacker.position === 'RIVAL' && target.position === 'SUPPORT') {
    base *= 1.5;
  }
  return base;
}

// ─── Weighted sampling (without replacement) ─────────────────────────────────

function weightedSample<T>(
  items: T[],
  weights: number[],
  count: number,
  rng: () => number,
): T[] {
  const selected: T[] = [];
  const rem = [...items];
  const remW = [...weights];

  while (selected.length < count && rem.length > 0) {
    const total = remW.reduce((a, b) => a + b, 0);
    if (total <= 0) break;

    let rand = rng() * total;
    let idx = rem.length - 1;
    for (let i = 0; i < remW.length; i++) {
      rand -= remW[i];
      if (rand <= 0) { idx = i; break; }
    }
    selected.push(rem[idx]);
    rem.splice(idx, 1);
    remW.splice(idx, 1);
  }
  return selected;
}

// ─── Check for existing link between a pair (either direction) ────────────────

function pairExists(from: string, to: string, links: Link[]): boolean {
  return links.some(
    (l) => (l.from === from && l.to === to) || (l.from === to && l.to === from),
  );
}

// ─── Core link generation ─────────────────────────────────────────────────────

export interface GenerateResult {
  newLinks: Link[];
  updatedExisting: CharacterNode[];
  updatedNew: CharacterNode;
}

/**
 * Generate all links when `newNode` is placed on the board.
 * Returns new links plus updated slot counts for all affected nodes.
 */
export function generateLinks(
  newNode: CharacterNode,
  existingNodes: CharacterNode[],
  existingLinks: Link[],
  rng: () => number,
): GenerateResult {
  const newLinks: Link[] = [];
  const nodeMap = new Map<string, CharacterNode>(
    existingNodes.map((n) => [n.id, { ...n }]),
  );
  let newCopy: CharacterNode = { ...newNode };

  const allLinks = () => [...existingLinks, ...newLinks];

  // ── First card rule: PROTAG must link to the very first non-PROTAG card ──
  const isFirstCard =
    existingNodes.length === 1 && existingNodes[0].position === 'PROTAG';
  if (isFirstCard) {
    const protag = nodeMap.get(existingNodes[0].id)!;
    if (!pairExists(protag.id, newCopy.id, allLinks())) {
      const { emotion, subCategory } = generateEmotion(protag, newCopy, rng);
      newLinks.push({ id: nextLinkId(), from: protag.id, to: newCopy.id, emotion, subCategory });
      protag.slotsRemaining = Math.max(0, protag.slotsRemaining - 1);
      nodeMap.set(protag.id, protag);
    }
  }

  // ── Step 1: Outgoing — newNode → existing cards ──────────────────────────
  if (newCopy.slotsRemaining > 0) {
    const candidates: { node: CharacterNode; w: number }[] = [];
    for (const node of existingNodes) {
      const dist = manhattanDistance(newCopy.x, newCopy.y, node.x, node.y);
      if (!isInRange(newCopy.range, dist)) continue;
      if (pairExists(newCopy.id, node.id, allLinks())) continue;
      const w = dist === 0 ? 1 : (1 / dist) * positionWeight(newCopy, node, rng);
      candidates.push({ node, w });
    }

    const selected = weightedSample(
      candidates,
      candidates.map((c) => c.w),
      newCopy.slotsRemaining,
      rng,
    );

    for (const { node } of selected) {
      if (pairExists(newCopy.id, node.id, allLinks())) continue;
      const { emotion, subCategory } = generateEmotion(newCopy, node, rng);
      newLinks.push({ id: nextLinkId(), from: newCopy.id, to: node.id, emotion, subCategory });
      newCopy = { ...newCopy, slotsRemaining: Math.max(0, newCopy.slotsRemaining - 1) };
    }
  }

  // ── Step 2: Incoming — existing cards → newNode ───────────────────────────
  for (const node of existingNodes) {
    const nodeData = nodeMap.get(node.id)!;
    if (nodeData.slotsRemaining <= 0) continue;

    const dist = manhattanDistance(node.x, node.y, newCopy.x, newCopy.y);
    if (!isInRange(nodeData.range, dist)) continue;
    if (pairExists(node.id, newCopy.id, allLinks())) continue;

    const w = dist === 0 ? 1 : (1 / dist) * positionWeight(nodeData, newCopy, rng);
    // Probabilistic: scale probability by weight (capped at 1)
    const prob = Math.min(1, w * 0.5);
    if (rng() < prob) {
      const { emotion, subCategory } = generateEmotion(nodeData, newCopy, rng);
      newLinks.push({
        id: nextLinkId(),
        from: node.id,
        to: newCopy.id,
        emotion,
        subCategory,
      });
      nodeData.slotsRemaining = Math.max(0, nodeData.slotsRemaining - 1);
      nodeMap.set(node.id, nodeData);
    }
  }

  return {
    newLinks,
    updatedExisting: Array.from(nodeMap.values()),
    updatedNew: newCopy,
  };
}

// ─── Reroll: regenerate all links from scratch ────────────────────────────────

export function rerollLinks(
  nodes: CharacterNode[],
  rng: () => number,
): { links: Link[]; updatedNodes: CharacterNode[] } {
  // Reset slot counts
  const resetNodes = nodes.map((n) => ({ ...n, slotsRemaining: n.slots }));

  // Process in placement order: PROTAG first, then rest
  const sorted = [...resetNodes].sort((a, b) => {
    if (a.position === 'PROTAG') return -1;
    if (b.position === 'PROTAG') return 1;
    return 0;
  });

  const placed: CharacterNode[] = [];
  const allLinks: Link[] = [];

  for (const node of sorted) {
    if (placed.length === 0) {
      placed.push(node);
      continue;
    }

    const { newLinks, updatedExisting, updatedNew } = generateLinks(
      node,
      placed,
      allLinks,
      rng,
    );
    allLinks.push(...newLinks);

    // Update already-placed nodes
    for (const updated of updatedExisting) {
      const idx = placed.findIndex((n) => n.id === updated.id);
      if (idx >= 0) placed[idx] = updated;
    }
    placed.push(updatedNew);
  }

  return { links: allLinks, updatedNodes: placed };
}
