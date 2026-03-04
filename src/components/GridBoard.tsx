import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  CharacterNode,
  Link,
  NextCard,
  EmotionColors,
  PositionColors,
  PositionLabels,
  PersonalityLabels,
} from '../types';
import { computePreviewLinks, PreviewCandidate } from '../engine/previewEngine';
import { calculateStats } from '../engine/characterGenerator';
import { createRNG } from '../engine/rng';

// ─── Constants ────────────────────────────────────────────────────────────────

const CELL = 100;        // px per grid unit (world coords)
const NODE_W = 80;
const NODE_H = 48;
const GRID_HALF = 8;     // grid spans -8 to +8 in each axis
const CURVE_OFFSET = 22; // world-px perpendicular offset for bidirectional curves

// ─── Helpers ──────────────────────────────────────────────────────────────────

const wx = (x: number) => x * CELL; // grid → world x
const wy = (y: number) => y * CELL; // grid → world y

// ─── Bidirectional curve path ─────────────────────────────────────────────────

interface RelationLineProp {
  link: Link;
  nodes: CharacterNode[];
  /** Set of "from|to" keys for every existing link (used for reverse-link detection). */
  linkKeySet: Set<string>;
}

const RelationLine: React.FC<RelationLineProp> = ({ link, nodes, linkKeySet }) => {
  const from = nodes.find((n) => n.id === link.from);
  const to   = nodes.find((n) => n.id === link.to);
  if (!from || !to) return null;

  const x1 = wx(from.x);
  const y1 = wy(from.y);
  const x2 = wx(to.x);
  const y2 = wy(to.y);
  const color = EmotionColors[link.emotion];

  // Detect whether a reverse link also exists
  const reverseKey = `${link.to}|${link.from}`;
  const isBidirectional = linkKeySet.has(reverseKey);

  // For bidirectional pairs we need a consistent "is this the forward direction?"
  // so that the two curves offset in opposite directions.
  const isForward = link.from < link.to; // lexicographic — stable & deterministic

  let pathD: string;
  let labelX: number;
  let labelY: number;

  if (isBidirectional) {
    // Compute perpendicular unit vector
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const perpX = -dy / len;
    const perpY =  dx / len;

    const sign = isForward ? 1 : -1;
    const cpX = (x1 + x2) / 2 + sign * CURVE_OFFSET * perpX;
    const cpY = (y1 + y2) / 2 + sign * CURVE_OFFSET * perpY;

    pathD = `M ${x1},${y1} Q ${cpX},${cpY} ${x2},${y2}`;

    // Midpoint of quadratic bezier at t = 0.5:
    // B(0.5) = 0.25*P0 + 0.5*CP + 0.25*P1
    labelX = 0.25 * x1 + 0.5 * cpX + 0.25 * x2;
    labelY = 0.25 * y1 + 0.5 * cpY + 0.25 * y2 - 5;
  } else {
    pathD = `M ${x1},${y1} L ${x2},${y2}`;
    labelX = (x1 + x2) / 2;
    labelY = (y1 + y2) / 2 - 5;
  }

  return (
    <g>
      <path
        d={pathD}
        stroke={color}
        strokeWidth={2}
        strokeOpacity={0.78}
        fill="none"
      />
      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        fontSize={9}
        fill={color}
        stroke="#0f0f1a"
        strokeWidth={2.5}
        paintOrder="stroke"
      >
        {link.subCategory}
      </text>
    </g>
  );
};

// ─── Character node card ──────────────────────────────────────────────────────

interface CharacterNodeViewProps {
  node: CharacterNode;
  onEdit: (node: CharacterNode) => void;
}

const LONG_PRESS_MS = 500;

const CharacterNodeView: React.FC<CharacterNodeViewProps> = ({ node, onEdit }) => {
  const cx = wx(node.x);
  const cy = wy(node.y);
  const color = PositionColors[node.position];

  // Long-press state (touch)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLP = () => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(node);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent the SVG drag-pan handler from capturing this press on a card
    e.stopPropagation();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      onEdit(node);
    }, LONG_PRESS_MS);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    clearLP();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    clearLP();
  };

  return (
    <g
      transform={`translate(${cx}, ${cy})`}
      style={{ pointerEvents: 'all', cursor: 'pointer' }}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      <rect
        x={-NODE_W / 2}
        y={-NODE_H / 2}
        width={NODE_W}
        height={NODE_H}
        rx={8}
        fill={color}
        stroke="#fff"
        strokeWidth={1.5}
        opacity={0.95}
      />
      <text
        y={-6}
        textAnchor="middle"
        fontSize={12}
        fontWeight="bold"
        fill="#111"
        dominantBaseline="middle"
      >
        {node.name}
      </text>
      <text
        y={10}
        textAnchor="middle"
        fontSize={9}
        fill="#333"
        dominantBaseline="middle"
      >
        {PositionLabels[node.position]} · {PersonalityLabels[node.personality]}
      </text>
    </g>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface GridBoardProps {
  id?: string;
  nodes: CharacterNode[];
  links: Link[];
  nextCard: NextCard | null;
  protagReady: boolean;
  onPlaceCard: (x: number, y: number) => boolean;
  onNodeEdit: (node: CharacterNode) => void;
}

export const GridBoard: React.FC<GridBoardProps> = ({
  id = 'fate-grid-svg',
  nodes,
  links,
  nextCard,
  protagReady,
  onPlaceCard,
  onNodeEdit,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Pan / zoom ──
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [scale, setScale] = useState(1);

  // ── Hover / preview ──
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);
  const [previewLinks, setPreviewLinks] = useState<PreviewCandidate[]>([]);

  // ── Drag state ──
  const dragRef = useRef<{
    startX: number; startY: number; startTx: number; startTy: number;
  } | null>(null);
  const touchRef  = useRef<{ id: number; x: number; y: number }[]>([]);
  const pinchRef  = useRef<number | null>(null);

  // Centre view on (0,0) once the container is mounted
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setTx(el.clientWidth / 2);
    setTy(el.clientHeight / 2);
  }, []);

  // ── Coordinate conversion ─────────────────────────────────────────────────

  const svgToGrid = useCallback(
    (svgX: number, svgY: number) => ({
      x: Math.round((svgX - tx) / scale / CELL),
      y: Math.round((svgY - ty) / scale / CELL),
    }),
    [tx, ty, scale],
  );

  const getPointerSVG = (
    e: React.MouseEvent | React.TouchEvent,
  ): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if ('touches' in e) {
      const t = e.touches[0];
      if (!t) return null;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  // ── Preview calculation ───────────────────────────────────────────────────

  const updatePreview = useCallback(
    (gx: number, gy: number) => {
      if (!nextCard || !protagReady) { setPreviewLinks([]); return; }
      const { range } = calculateStats(nextCard.position, nextCard.personality, createRNG(0));
      setPreviewLinks(computePreviewLinks(gx, gy, nextCard.position, range, nodes, links));
    },
    [nextCard, protagReady, nodes, links],
  );

  // ── Mouse handlers ────────────────────────────────────────────────────────

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const pos = getPointerSVG(e);
    if (!pos) return;
    dragRef.current = { startX: pos.x, startY: pos.y, startTx: tx, startTy: ty };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getPointerSVG(e);
    if (!pos) return;

    if (dragRef.current) {
      setTx(dragRef.current.startTx + (pos.x - dragRef.current.startX));
      setTy(dragRef.current.startTy + (pos.y - dragRef.current.startY));
      setHoveredCell(null);
      setPreviewLinks([]);
      return;
    }

    const grid = svgToGrid(pos.x, pos.y);
    if (nodes.some((n) => n.x === grid.x && n.y === grid.y)) {
      setHoveredCell(null);
      setPreviewLinks([]);
    } else {
      setHoveredCell(grid);
      updatePreview(grid.x, grid.y);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const dr = dragRef.current;
    dragRef.current = null;

    if (!dr) return; // click landed on a character node (stopPropagation)

    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;
    const wasDragging =
      Math.abs(e.clientX - (svgRect.left + dr.startX)) > 5 ||
      Math.abs(e.clientY - (svgRect.top  + dr.startY)) > 5;

    if (!wasDragging && protagReady && nextCard && nodes.length < 27) {
      const pos = getPointerSVG(e);
      if (pos) onPlaceCard(svgToGrid(pos.x, pos.y).x, svgToGrid(pos.x, pos.y).y);
    }
    setHoveredCell(null);
    setPreviewLinks([]);
  };

  const handleMouseLeave = () => {
    dragRef.current = null;
    setHoveredCell(null);
    setPreviewLinks([]);
  };

  // ── Wheel zoom ────────────────────────────────────────────────────────────

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const pos = getPointerSVG(e);
    if (!pos) return;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newScale = Math.min(3, Math.max(0.25, scale * factor));
    setScale(newScale);
    setTx(pos.x - (pos.x - tx) * (newScale / scale));
    setTy(pos.y - (pos.y - ty) * (newScale / scale));
  };

  // ── Touch handlers ────────────────────────────────────────────────────────

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const rect = svgRef.current!.getBoundingClientRect();
    touchRef.current = Array.from(e.touches).map((t) => ({
      id: t.identifier,
      x: t.clientX - rect.left,
      y: t.clientY - rect.top,
    }));

    if (e.touches.length === 1) {
      dragRef.current = {
        startX: touchRef.current[0].x,
        startY: touchRef.current[0].y,
        startTx: tx,
        startTy: ty,
      };
      pinchRef.current = null;
    } else if (e.touches.length === 2) {
      const dx = touchRef.current[1].x - touchRef.current[0].x;
      const dy = touchRef.current[1].y - touchRef.current[0].y;
      pinchRef.current = Math.hypot(dx, dy);
      dragRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const rect = svgRef.current!.getBoundingClientRect();
    const touches = Array.from(e.touches).map((t) => ({
      id: t.identifier,
      x: t.clientX - rect.left,
      y: t.clientY - rect.top,
    }));

    if (touches.length === 1 && dragRef.current) {
      setTx(dragRef.current.startTx + (touches[0].x - dragRef.current.startX));
      setTy(dragRef.current.startTy + (touches[0].y - dragRef.current.startY));
    } else if (touches.length === 2 && pinchRef.current !== null) {
      const dx = touches[1].x - touches[0].x;
      const dy = touches[1].y - touches[0].y;
      const dist = Math.hypot(dx, dy);
      const factor = dist / pinchRef.current;
      const midX = (touches[0].x + touches[1].x) / 2;
      const midY = (touches[0].y + touches[1].y) / 2;
      const newScale = Math.min(3, Math.max(0.25, scale * factor));
      setScale(newScale);
      setTx(midX - (midX - tx) * (newScale / scale));
      setTy(midY - (midY - ty) * (newScale / scale));
      pinchRef.current = dist;
    }
    touchRef.current = touches;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    const rect = svgRef.current!.getBoundingClientRect();

    if (e.changedTouches.length === 1 && dragRef.current && e.touches.length === 0) {
      const t = e.changedTouches[0];
      const endX = t.clientX - rect.left;
      const endY = t.clientY - rect.top;
      const dx = Math.abs(endX - dragRef.current.startX);
      const dy = Math.abs(endY - dragRef.current.startY);

      if (dx < 10 && dy < 10 && protagReady && nextCard && nodes.length < 27) {
        const grid = svgToGrid(endX, endY);
        onPlaceCard(grid.x, grid.y);
      }
    }

    dragRef.current = null;
    pinchRef.current = null;
    touchRef.current = [];
    setHoveredCell(null);
    setPreviewLinks([]);
  };

  // ── Pre-compute link key set for bidirectional detection ──────────────────

  const linkKeySet = new Set(links.map((l) => `${l.from}|${l.to}`));

  // ── Grid cell rendering ───────────────────────────────────────────────────

  const gridCells: React.ReactNode[] = [];
  for (let gxi = -GRID_HALF; gxi <= GRID_HALF; gxi++) {
    for (let gyi = -GRID_HALF; gyi <= GRID_HALF; gyi++) {
      const cx = wx(gxi);
      const cy = wy(gyi);
      const isHov = hoveredCell?.x === gxi && hoveredCell?.y === gyi;
      const isOcc = nodes.some((n) => n.x === gxi && n.y === gyi);
      gridCells.push(
        <rect
          key={`cell_${gxi}_${gyi}`}
          x={cx - CELL / 2}
          y={cy - CELL / 2}
          width={CELL}
          height={CELL}
          fill={isHov ? 'rgba(255,211,42,0.12)' : 'transparent'}
          stroke={isOcc ? 'transparent' : '#1e293b'}
          strokeWidth={0.5}
        />,
      );
    }
  }

  const transform = `translate(${tx}, ${ty}) scale(${scale})`;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative grid-board"
      style={{ background: '#0f0f1a' }}
    >
      <svg
        ref={svgRef}
        id={id}
        width="100%"
        height="100%"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: 'crosshair', touchAction: 'none' }}
      >
        <g transform={transform}>
          {/* Grid cells */}
          {gridCells}

          {/* Relationship lines (rendered below nodes) */}
          {links.map((link) => (
            <RelationLine key={link.id} link={link} nodes={nodes} linkKeySet={linkKeySet} />
          ))}

          {/* Preview dashed lines */}
          {hoveredCell &&
            previewLinks.map((p, i) => (
              <line
                key={`preview_${i}`}
                x1={wx(hoveredCell.x)}
                y1={wy(hoveredCell.y)}
                x2={wx(p.x)}
                y2={wy(p.y)}
                stroke={EmotionColors[p.emotion]}
                strokeWidth={1.5}
                strokeOpacity={0.4}
                strokeDasharray="6,4"
                style={{ pointerEvents: 'none' }}
              />
            ))}

          {/* Hover cell highlight */}
          {hoveredCell && (
            <rect
              x={wx(hoveredCell.x) - CELL / 2}
              y={wy(hoveredCell.y) - CELL / 2}
              width={CELL}
              height={CELL}
              rx={8}
              fill="rgba(255,211,42,0.18)"
              stroke="#ffd32a"
              strokeWidth={1.5}
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Character nodes (rendered on top) */}
          {nodes.map((node) => (
            <CharacterNodeView key={node.id} node={node} onEdit={onNodeEdit} />
          ))}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        <button
          onClick={() => setScale((s) => Math.min(3, s * 1.2))}
          className="w-8 h-8 bg-gray-800 border border-gray-700 text-white rounded text-lg leading-none hover:bg-gray-700"
        >
          +
        </button>
        <button
          onClick={() => setScale((s) => Math.max(0.25, s / 1.2))}
          className="w-8 h-8 bg-gray-800 border border-gray-700 text-white rounded text-lg leading-none hover:bg-gray-700"
        >
          −
        </button>
        <button
          onClick={() => {
            const el = containerRef.current;
            if (el) { setTx(el.clientWidth / 2); setTy(el.clientHeight / 2); setScale(1); }
          }}
          className="w-8 h-8 bg-gray-800 border border-gray-700 text-gray-400 rounded text-xs leading-none hover:bg-gray-700"
        >
          ⊙
        </button>
      </div>

      {/* Hint label */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-gray-600 pointer-events-none select-none">
        더블클릭 / 길게 누르기 = 이름 편집
      </div>
    </div>
  );
};
