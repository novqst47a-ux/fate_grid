import { create } from 'zustand';
import {
  CharacterNode,
  Link,
  Position,
  Personality,
  NextCard,
} from '../types';
import { createRNG, randomSeed } from '../engine/rng';
import { createCharacterNode, generateNextCard } from '../engine/characterGenerator';
import { generateLinks, rerollLinks } from '../engine/relationshipEngine';
import { saveSession, loadSession, clearSession } from '../storage/sessionManager';

// ─── Store shape ──────────────────────────────────────────────────────────────

export interface GameStore {
  nodes: CharacterNode[];
  links: Link[];
  seed: number;
  nextCard: NextCard | null;

  /** True once PROTAG has been named and personalised. */
  protagReady: boolean;

  // ── Actions ──
  initSession: () => void;
  setupProtag: (name: string, personality: Personality) => void;
  placeCard: (x: number, y: number) => boolean;
  reroll: () => void;
  reset: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRNG(seed: number) {
  return createRNG(seed);
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStore = create<GameStore>((set, get) => ({
  nodes: [],
  links: [],
  seed: 0,
  nextCard: null,
  protagReady: false,

  /** Called once on app mount. Restores from LocalStorage or starts fresh. */
  initSession() {
    const saved = loadSession();
    if (saved && saved.nodes.length > 0) {
      const rng = makeRNG(saved.seed);
      const nextCard = generateNextCard(rng);
      const protagReady = saved.nodes.find((n) => n.position === 'PROTAG')?.name !== '';
      set({
        nodes: saved.nodes,
        links: saved.links,
        seed: saved.seed,
        nextCard,
        protagReady: !!protagReady,
      });
    } else {
      // Fresh session: place unnamed PROTAG at center
      const seed = randomSeed();
      const rng = makeRNG(seed);
      const protag: CharacterNode = createCharacterNode(
        'protag_0',
        '', // Name filled in SetupModal
        'PROTAG',
        'SOCIAL', // temporary; overridden in setupProtag
        0,
        0,
        rng,
      );
      set({ nodes: [protag], links: [], seed, nextCard: null, protagReady: false });
    }
  },

  /** User submits PROTAG name + personality. */
  setupProtag(name: string, personality: Personality) {
    const { nodes, seed } = get();
    const rng = makeRNG(seed);
    const protag = nodes[0];
    // Recalculate stats with chosen personality
    const updated = createCharacterNode(
      protag.id,
      name,
      'PROTAG',
      personality,
      protag.x,
      protag.y,
      rng,
    );
    const nextCard = generateNextCard(rng);
    const newNodes = [updated];
    saveSession({ nodes: newNodes, links: [], seed });
    set({ nodes: newNodes, links: [], nextCard, protagReady: true });
  },

  /**
   * Place the current nextCard at grid (x, y).
   * Returns false if cell is occupied or limit reached.
   */
  placeCard(x: number, y: number): boolean {
    const { nodes, links, seed, nextCard } = get();
    if (!nextCard) return false;
    if (nodes.length >= 27) return false;
    if (nodes.some((n) => n.x === x && n.y === y)) return false;

    const rng = makeRNG(seed + nodes.length); // advance seed deterministically
    const newNode = createCharacterNode(
      `char_${nodes.length}_${Date.now()}`,
      nextCard.position, // name defaults to position label; user can't rename for now
      nextCard.position,
      nextCard.personality,
      x,
      y,
      rng,
    );

    const { newLinks, updatedExisting, updatedNew } = generateLinks(
      newNode,
      nodes,
      links,
      rng,
    );

    // Merge updated existing nodes
    const mergedNodes = nodes.map((n) => {
      const updated = updatedExisting.find((u) => u.id === n.id);
      return updated ?? n;
    });
    mergedNodes.push(updatedNew);
    const mergedLinks = [...links, ...newLinks];

    // Generate next card
    const nextRng = makeRNG(seed + mergedNodes.length);
    const newNextCard = generateNextCard(nextRng);

    saveSession({ nodes: mergedNodes, links: mergedLinks, seed });
    set({ nodes: mergedNodes, links: mergedLinks, nextCard: newNextCard });
    return true;
  },

  /** Keep nodes/coordinates; delete all links and regenerate. */
  reroll() {
    const { nodes, seed } = get();
    const newSeed = randomSeed();
    const rng = makeRNG(newSeed);
    const { links: newLinks, updatedNodes } = rerollLinks(nodes, rng);
    saveSession({ nodes: updatedNodes, links: newLinks, seed: newSeed });
    set({ nodes: updatedNodes, links: newLinks, seed: newSeed });
  },

  /** Delete everything; restart with a fresh PROTAG. */
  reset() {
    clearSession();
    const seed = randomSeed();
    const rng = makeRNG(seed);
    const protag = createCharacterNode('protag_0', '', 'PROTAG', 'SOCIAL', 0, 0, rng);
    set({ nodes: [protag], links: [], seed, nextCard: null, protagReady: false });
  },
}));
