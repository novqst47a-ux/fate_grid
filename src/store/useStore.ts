import { create } from 'zustand';
import {
  CharacterNode,
  Link,
  Position,
  Personality,
  NextCard,
  PositionLabels,
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
  renameNode: (id: string, newName: string) => void;
  reroll: () => void;
  reset: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRNG(seed: number) {
  return createRNG(seed);
}

/** A-Z suffix string from a 1-based placement index. */
function suffixLetter(placementIndex: number): string {
  return String.fromCharCode(64 + placementIndex); // 1→'A', 2→'B', ...
}

/** Default display name for a newly placed card. */
function defaultCardName(position: Position, placementIndex: number): string {
  return `${PositionLabels[position]}${suffixLetter(placementIndex)}`;
}

/** Migrate a node from an older saved session that may lack placementIndex. */
function migrateNode(n: CharacterNode): CharacterNode {
  return { ...n, placementIndex: n.placementIndex ?? 0 };
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
      const nodes = saved.nodes.map(migrateNode);
      const rng = makeRNG(saved.seed);
      const nextCard = generateNextCard(rng);
      const protagReady = nodes.find((n) => n.position === 'PROTAG')?.name !== '';
      set({ nodes, links: saved.links, seed: saved.seed, nextCard, protagReady: !!protagReady });
    } else {
      const seed = randomSeed();
      const rng = makeRNG(seed);
      const protag = createCharacterNode('protag_0', '', 'PROTAG', 'SOCIAL', 0, 0, rng, 0);
      set({ nodes: [protag], links: [], seed, nextCard: null, protagReady: false });
    }
  },

  /** User submits PROTAG name + personality via SetupModal. */
  setupProtag(name: string, personality: Personality) {
    const { nodes, seed } = get();
    const rng = makeRNG(seed);
    const protag = nodes[0];
    const updated = createCharacterNode(protag.id, name, 'PROTAG', personality, protag.x, protag.y, rng, 0);
    const nextCard = generateNextCard(rng);
    const newNodes = [updated];
    saveSession({ nodes: newNodes, links: [], seed });
    set({ nodes: newNodes, links: [], nextCard, protagReady: true });
  },

  /**
   * Place the current nextCard at grid (x, y).
   * Returns false if cell is occupied or the 27-card limit is reached.
   */
  placeCard(x: number, y: number): boolean {
    const { nodes, links, seed, nextCard } = get();
    if (!nextCard) return false;
    if (nodes.length >= 27) return false;
    if (nodes.some((n) => n.x === x && n.y === y)) return false;

    // placementIndex counts only user-placed (non-PROTAG) cards, 1-based → A–Z
    const userPlacedSoFar = nodes.filter((n) => n.position !== 'PROTAG').length;
    const placementIndex = userPlacedSoFar + 1;
    const cardName = defaultCardName(nextCard.position, placementIndex);

    const rng = makeRNG(seed + nodes.length);
    const newNode = createCharacterNode(
      `char_${nodes.length}_${Date.now()}`,
      cardName,
      nextCard.position,
      nextCard.personality,
      x,
      y,
      rng,
      placementIndex,
    );

    const { newLinks, updatedExisting, updatedNew } = generateLinks(newNode, nodes, links, rng);

    const mergedNodes = nodes.map((n) => updatedExisting.find((u) => u.id === n.id) ?? n);
    mergedNodes.push(updatedNew);
    const mergedLinks = [...links, ...newLinks];

    const nextRng = makeRNG(seed + mergedNodes.length);
    const newNextCard = generateNextCard(nextRng);

    saveSession({ nodes: mergedNodes, links: mergedLinks, seed });
    set({ nodes: mergedNodes, links: mergedLinks, nextCard: newNextCard });
    return true;
  },

  /** Rename an existing node; persists immediately to LocalStorage. */
  renameNode(id: string, newName: string) {
    const { nodes, links, seed } = get();
    const updatedNodes = nodes.map((n) => (n.id === id ? { ...n, name: newName } : n));
    saveSession({ nodes: updatedNodes, links, seed });
    set({ nodes: updatedNodes });
  },

  /** Keep node positions; delete all links and regenerate relationships. */
  reroll() {
    const { nodes } = get();
    const newSeed = randomSeed();
    const rng = makeRNG(newSeed);
    const { links: newLinks, updatedNodes } = rerollLinks(nodes, rng);
    saveSession({ nodes: updatedNodes, links: newLinks, seed: newSeed });
    set({ nodes: updatedNodes, links: newLinks, seed: newSeed });
  },

  /** Delete everything; restart with a fresh unnamed PROTAG. */
  reset() {
    clearSession();
    const seed = randomSeed();
    const rng = makeRNG(seed);
    const protag = createCharacterNode('protag_0', '', 'PROTAG', 'SOCIAL', 0, 0, rng, 0);
    set({ nodes: [protag], links: [], seed, nextCard: null, protagReady: false });
  },
}));
