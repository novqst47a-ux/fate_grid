/**
 * Tests for the three-tiered link visualization decision logic.
 * The actual SVG rendering is in GridBoard.tsx (React component), but we can
 * test the core data-side logic that drives Type 1/2/3 classification.
 */

import { describe, it, expect } from 'vitest';
import { generateLinks } from '../relationshipEngine';
import { createCharacterNode } from '../characterGenerator';
import { createRNG } from '../rng';
import { Link } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildLinkMap(links: Link[]): Map<string, Link> {
  return new Map(links.map((l) => [`${l.from}|${l.to}`, l]));
}

function classifyPair(
  linkA: Link,
  linkB: Link,
): 'type1-same' | 'type3-diff' {
  return linkA.emotion === linkB.emotion ? 'type1-same' : 'type3-diff';
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('linkMap — reverse-link detection', () => {
  it('detects a bidirectional pair via reverse key lookup', () => {
    const links: Link[] = [
      { id: 'a', from: 'X', to: 'Y', emotion: 'Love',     subCategory: '연인' },
      { id: 'b', from: 'Y', to: 'X', emotion: 'Hostile',  subCategory: '증오' },
    ];
    const map = buildLinkMap(links);
    expect(map.has('X|Y')).toBe(true);
    expect(map.has('Y|X')).toBe(true);
    expect(map.get('Y|X')?.emotion).toBe('Hostile');
  });

  it('does not find reverse when link is one-sided', () => {
    const links: Link[] = [
      { id: 'a', from: 'X', to: 'Y', emotion: 'Friendly', subCategory: '신뢰' },
    ];
    const map = buildLinkMap(links);
    expect(map.has('X|Y')).toBe(true);
    expect(map.has('Y|X')).toBe(false);
  });
});

describe('Type 1 — same emotion', () => {
  it('classifies a mutual-same-emotion pair as type1-same', () => {
    const a: Link = { id: 'a', from: 'X', to: 'Y', emotion: 'Friendly', subCategory: '단짝' };
    const b: Link = { id: 'b', from: 'Y', to: 'X', emotion: 'Friendly', subCategory: '호의' };
    expect(classifyPair(a, b)).toBe('type1-same');
  });

  it('deduplication: only one direction should render (from < to lexicographically)', () => {
    // Simulate the dedup guard: skip if link.from > link.to
    // 'char_1' starts with 'c', 'protag_0' starts with 'p'; 'c' < 'p' in ASCII
    const linkA = { id: 'a', from: 'char_1',   to: 'protag_0', emotion: 'Love', subCategory: '연인'   } as Link;
    const linkB = { id: 'b', from: 'protag_0', to: 'char_1',   emotion: 'Love', subCategory: '짝사랑' } as Link;
    const map = buildLinkMap([linkA, linkB]);

    expect(map.has('char_1|protag_0')).toBe(true);
    expect(map.has('protag_0|char_1')).toBe(true);

    // Guard: linkA.from < linkA.to → renders; linkB.from > linkB.to → skipped
    expect(linkA.from < linkA.to).toBe(true);  // 'char_1' < 'protag_0' → renders
    expect(linkB.from > linkB.to).toBe(true);  // 'protag_0' > 'char_1' → skip
  });
});

describe('Type 3 — different emotions', () => {
  it('classifies a mutual-different-emotion pair as type3-diff', () => {
    const a: Link = { id: 'a', from: 'X', to: 'Y', emotion: 'Love',    subCategory: '동경' };
    const b: Link = { id: 'b', from: 'Y', to: 'X', emotion: 'Hostile', subCategory: '원수' };
    expect(classifyPair(a, b)).toBe('type3-diff');
  });

  it('A→B and B→A have opposite curve signs for offset separation', () => {
    // sign = (link.from < link.to) ? 1 : -1
    const linkAB = { from: 'char_1', to: 'protag_0' } as Link;
    const linkBA = { from: 'protag_0', to: 'char_1' } as Link;
    const signAB = linkAB.from < linkAB.to ? 1 : -1; // 'char_1' < 'protag_0' → false → -1
    const signBA = linkBA.from < linkBA.to ? 1 : -1; // 'protag_0' < 'char_1' → false → -1
    // With the same lexicographic rule, signs are opposite when from/to are swapped
    expect(signAB).toBe(-signBA);
  });
});

describe('Type 2 — one-sided links', () => {
  it('generates at least one link when placing second card near PROTAG', () => {
    const protag = createCharacterNode('protag_0', '주인공', 'PROTAG', 'SOCIAL', 0, 0, createRNG(1), 0);
    const support = createCharacterNode('char_1', '조연A', 'SUPPORT', 'BRIGHT', 1, 0, createRNG(2), 1);
    const { newLinks } = generateLinks(support, [protag], [], createRNG(10));
    expect(newLinks.length).toBeGreaterThan(0);

    const map = buildLinkMap(newLinks);
    // For each link, check whether a reverse exists
    for (const link of newLinks) {
      const reverseExists = map.has(`${link.to}|${link.from}`);
      // Even if bidirectional, the map should reflect what was generated
      if (!reverseExists) {
        // This is a Type-2 link — confirm it has valid data
        expect(link.from).toBeTruthy();
        expect(link.to).toBeTruthy();
      }
    }
  });
});
