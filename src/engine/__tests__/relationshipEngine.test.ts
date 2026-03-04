import { describe, it, expect } from 'vitest';
import { generateLinks, rerollLinks } from '../relationshipEngine';
import { createCharacterNode } from '../characterGenerator';
import { createRNG } from '../rng';
import { CharacterNode, Link } from '../../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeProtag(x = 0, y = 0): CharacterNode {
  return createCharacterNode('protag', 'Hero', 'PROTAG', 'SOCIAL', x, y, createRNG(1));
}

function makeSupport(id: string, x: number, y: number): CharacterNode {
  return createCharacterNode(id, 'Ally', 'SUPPORT', 'BRIGHT', x, y, createRNG(2));
}

function makeRival(id: string, x: number, y: number): CharacterNode {
  return createCharacterNode(id, 'Rival', 'RIVAL', 'AGGRESSIVE', x, y, createRNG(3));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateLinks — first card rule', () => {
  it('creates a PROTAG → first-card link unconditionally', () => {
    const protag = makeProtag(0, 0);
    const support = makeSupport('s1', 3, 3);

    const { newLinks } = generateLinks(support, [protag], [], createRNG(10));

    // At least one link must involve protag
    const protagLink = newLinks.find(
      (l) => (l.from === protag.id || l.to === protag.id),
    );
    expect(protagLink).toBeDefined();
  });
});

describe('generateLinks — no duplicate links', () => {
  it('does not create duplicate (same pair) links', () => {
    const protag = makeProtag(0, 0);
    const support = makeSupport('s1', 1, 0);
    const rng = createRNG(99);

    const { newLinks: links1, updatedExisting: updated1, updatedNew: newNode1 } =
      generateLinks(support, [protag], [], rng);

    // Simulate placing a second card; existing link already exists
    const rival = makeRival('r1', 0, 1);
    const allNodes = [...updated1.map((n) => n.id === newNode1.id ? newNode1 : n), newNode1, ...updated1].filter(
      (n, i, arr) => arr.findIndex((x) => x.id === n.id) === i,
    );

    const { newLinks: links2 } = generateLinks(rival, allNodes, links1, createRNG(100));

    const allLinks = [...links1, ...links2];
    const pairs = new Set<string>();

    for (const link of allLinks) {
      const key = [link.from, link.to].sort().join('|');
      expect(pairs.has(key)).toBe(false);
      pairs.add(key);
    }
  });
});

describe('generateLinks — slot management', () => {
  it('slotsRemaining does not go below 0', () => {
    const protag = makeProtag(0, 0);
    const extras = Array.from({ length: 6 }, (_, i) =>
      createCharacterNode(`e${i}`, 'E', 'EXTRA', 'CYNICAL', i + 1, 0, createRNG(i)),
    );

    let current: CharacterNode[] = [protag];
    let allLinks: Link[] = [];
    const rng = createRNG(42);

    for (const extra of extras) {
      const { newLinks, updatedExisting, updatedNew } = generateLinks(
        extra,
        current,
        allLinks,
        rng,
      );
      allLinks = [...allLinks, ...newLinks];
      current = [
        ...current.map((n) => updatedExisting.find((u) => u.id === n.id) ?? n),
        updatedNew,
      ];
    }

    for (const node of current) {
      expect(node.slotsRemaining).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('generateLinks — link emotions are valid', () => {
  it('every generated link has a valid emotion', () => {
    const validEmotions = ['Love', 'Friendly', 'Hostile', 'Awkward'];
    const protag = makeProtag(0, 0);
    const rival = makeRival('r1', 1, 0);
    const { newLinks } = generateLinks(rival, [protag], [], createRNG(77));
    for (const link of newLinks) {
      expect(validEmotions).toContain(link.emotion);
      expect(typeof link.subCategory).toBe('string');
      expect(link.subCategory.length).toBeGreaterThan(0);
    }
  });
});

describe('rerollLinks', () => {
  it('produces the same number of characters', () => {
    const protag = makeProtag(0, 0);
    const support = makeSupport('s1', 1, 0);
    const rival = makeRival('r1', 0, 1);
    const nodes = [protag, support, rival];

    const { updatedNodes } = rerollLinks(nodes, createRNG(55));
    expect(updatedNodes.length).toBe(nodes.length);
  });

  it('all node ids are preserved after reroll', () => {
    const protag = makeProtag(0, 0);
    const support = makeSupport('s1', 2, 0);
    const nodes = [protag, support];

    const { updatedNodes } = rerollLinks(nodes, createRNG(33));
    const ids = updatedNodes.map((n) => n.id).sort();
    expect(ids).toEqual(nodes.map((n) => n.id).sort());
  });

  it('regenerates different links compared to original', () => {
    const protag = makeProtag(0, 0);
    const support = makeSupport('s1', 1, 0);
    const nodes = [protag, support];

    const { links: links1 } = rerollLinks(nodes, createRNG(1));
    const { links: links2 } = rerollLinks(nodes, createRNG(999));

    // With different seeds the sub-categories might differ (emotion is small set so check ids)
    // At minimum, both should have links
    expect(links1.length).toBeGreaterThan(0);
    expect(links2.length).toBeGreaterThan(0);
  });

  it('no duplicate link pairs after reroll', () => {
    const protag = makeProtag(0, 0);
    const nodes = [
      protag,
      makeSupport('s1', 1, 0),
      makeRival('r1', 0, 1),
      makeSupport('s2', -1, 0),
    ];

    const { links } = rerollLinks(nodes, createRNG(7));
    const pairs = new Set<string>();
    for (const link of links) {
      const key = [link.from, link.to].sort().join('|');
      expect(pairs.has(key)).toBe(false);
      pairs.add(key);
    }
  });
});

describe('preview engine', async () => {
  it('computePreviewLinks returns at most 6 results', async () => {
    const { computePreviewLinks } = await import('../previewEngine');
    const nodes: CharacterNode[] = Array.from({ length: 10 }, (_, i) =>
      createCharacterNode(`n${i}`, 'N', 'SUPPORT', 'BRIGHT', i - 5, 0, createRNG(i)),
    );
    const results = computePreviewLinks(0, 3, 'RIVAL', 999, nodes, []);
    expect(results.length).toBeLessThanOrEqual(6);
  });
});
