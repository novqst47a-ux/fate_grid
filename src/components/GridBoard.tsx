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

const CELL = 100;         // px per grid unit
const NODE_W = 80;
const NODE_H = 48;
const GRID_HALF = 8;      // visible grid extends from -8 to +8 in each axis

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gx(x: number) { return x * CELL; }
function gy(y: number) { return y * CELL; }

// ─── Sub-components ───────────────────────────────────────────────────────────

const CharacterNodeView: React.FC<{ node: CharacterNode }> = ({ node }) => {
  const cx = gx(node.x);
  const cy = gy(node.y);
  const color = PositionColors[node.position];

  return (
    <g transform={`translate(${cx}, ${cy})`} style={{ pointerEvents: 'none' }}>
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
        {node.name || PositionLabels[node.position]}
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

interface RelationLineProp {
  link: Link;
  nodes: CharacterNode[];
}

const RelationLine: React.FC<RelationLineProp> = ({ link, nodes }) => {
  const from = nodes.find((n) => n.id === link.from);
  const to = nodes.find((n) => n.id === link.to);
  if (!from || !to) return null;

  const x1 = gx(from.x);
  const y1 = gy(from.y);
  const x2 = gx(to.x);
  const y2 = gy(to.y);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const color = EmotionColors[link.emotion];

  return (
    <g>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color}
        strokeWidth={2}
        strokeOpacity={0.75}
      />
      <text
        x={mx} y={my - 4}
        textAnchor="middle"
        fontSize={9}
        fill={color}
        stroke="#0f0f1a"
        strokeWidth={2}
        paintOrder="stroke"
      >
        {link.subCategory}
      </text>
    </g>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface GridBoardProps {
  id?: string; // for export (SVG id)
  nodes: CharacterNode[];
  links: Link[];
  nextCard: NextCard | null;
  protagReady: boolean;
  onPlaceCard: (x: number, y: number) => boolean;
}

export const GridBoard: React.FC<GridBoardProps> = ({
  id = 'fate-grid-svg',
  nodes,
  links,
  nextCard,
  protagReady,
  onPlaceCard,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Pan / zoom state ──
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [scale, setScale] = useState(1);

  // ── Hover / preview ──
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);
  const [previewLinks, setPreviewLinks] = useState<PreviewCandidate[]>([]);

  // ── Drag state ──
  const dragRef = useRef<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null);
  const touchRef = useRef<{ id: number; x: number; y: number }[]>([]);
  const pinchRef = useRef<number | null>(null);

  // Centre view on (0,0) initially
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setTx(el.clientWidth / 2);
    setTy(el.clientHeight / 2);
  }, []);

  // ── Coordinate helpers ──────────────────────────────────────────────────────

  /** Convert SVG viewport coords to grid coords. */
  const svgToGrid = useCallback(
    (svgX: number, svgY: number): { x: number; y: number } => {
      const worldX = (svgX - tx) / scale;
      const worldY = (svgY - ty) / scale;
      return {
        x: Math.round(worldX / CELL),
        y: Math.round(worldY / CELL),
      };
    },
    [tx, ty, scale],
  );

  /** Get pointer position relative to SVG element. */
  const getPointerSVG = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
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

  // ── Preview calculation ──────────────────────────────────────────────────────

  const updatePreview = useCallback(
    (gx: number, gy: number) => {
      if (!nextCard || !protagReady) {
        setPreviewLinks([]);
        return;
      }
      const { range } = calculateStats(nextCard.position, nextCard.personality, createRNG(0));
      const candidates = computePreviewLinks(gx, gy, nextCard.position, range, nodes, links);
      setPreviewLinks(candidates);
    },
    [nextCard, protagReady, nodes, links],
  );

  // ── Mouse event handlers ─────────────────────────────────────────────────────

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
      const dx = pos.x - dragRef.current.startX;
      const dy = pos.y - dragRef.current.startY;
      setTx(dragRef.current.startTx + dx);
      setTy(dragRef.current.startTy + dy);
      setHoveredCell(null);
      setPreviewLinks([]);
      return;
    }

    const grid = svgToGrid(pos.x, pos.y);
    const occupied = nodes.some((n) => n.x === grid.x && n.y === grid.y);
    if (!occupied) {
      setHoveredCell(grid);
      updatePreview(grid.x, grid.y);
    } else {
      setHoveredCell(null);
      setPreviewLinks([]);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const wasDragging =
      dragRef.current &&
      (Math.abs(e.clientX - (dragRef.current.startX + svgRef.current!.getBoundingClientRect().left)) > 5 ||
        Math.abs(e.clientY - (dragRef.current.startY + svgRef.current!.getBoundingClientRect().top)) > 5);
    dragRef.current = null;

    if (wasDragging) return;

    const pos = getPointerSVG(e);
    if (!pos) return;
    const grid = svgToGrid(pos.x, pos.y);
    if (protagReady && nextCard && nodes.length < 27) {
      const placed = onPlaceCard(grid.x, grid.y);
      if (!placed) {
        // Cell occupied — notify user briefly
      }
    }
    setHoveredCell(null);
    setPreviewLinks([]);
  };

  const handleMouseLeave = () => {
    dragRef.current = null;
    setHoveredCell(null);
    setPreviewLinks([]);
  };

  // ── Wheel zoom ───────────────────────────────────────────────────────────────

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const pos = getPointerSVG(e);
    if (!pos) return;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newScale = Math.min(3, Math.max(0.25, scale * factor));
    // Zoom towards cursor
    const newTx = pos.x - (pos.x - tx) * (newScale / scale);
    const newTy = pos.y - (pos.y - ty) * (newScale / scale);
    setScale(newScale);
    setTx(newTx);
    setTy(newTy);
  };

  // ── Touch event handlers ─────────────────────────────────────────────────────

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
      const dx = touches[0].x - dragRef.current.startX;
      const dy = touches[0].y - dragRef.current.startY;
      setTx(dragRef.current.startTx + dx);
      setTy(dragRef.current.startTy + dy);
    } else if (touches.length === 2 && pinchRef.current !== null) {
      const dx = touches[1].x - touches[0].x;
      const dy = touches[1].y - touches[0].y;
      const dist = Math.hypot(dx, dy);
      const factor = dist / pinchRef.current;
      const midX = (touches[0].x + touches[1].x) / 2;
      const midY = (touches[0].y + touches[1].y) / 2;
      const newScale = Math.min(3, Math.max(0.25, scale * factor));
      setTx(midX - (midX - tx) * (newScale / scale));
      setTy(midY - (midY - ty) * (newScale / scale));
      setScale(newScale);
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

      if (dx < 10 && dy < 10) {
        // Tap — place card
        const grid = svgToGrid(endX, endY);
        if (protagReady && nextCard && nodes.length < 27) {
          onPlaceCard(grid.x, grid.y);
        }
      }
    }

    dragRef.current = null;
    pinchRef.current = null;
    touchRef.current = [];
    setHoveredCell(null);
    setPreviewLinks([]);
  };

  // ── Grid cells ───────────────────────────────────────────────────────────────

  const gridCells: React.ReactNode[] = [];
  for (let gxi = -GRID_HALF; gxi <= GRID_HALF; gxi++) {
    for (let gyi = -GRID_HALF; gyi <= GRID_HALF; gyi++) {
      const cx = gx(gxi);
      const cy = gy(gyi);
      const isHovered = hoveredCell?.x === gxi && hoveredCell?.y === gyi;
      const isOccupied = nodes.some((n) => n.x === gxi && n.y === gyi);

      gridCells.push(
        <rect
          key={`cell_${gxi}_${gyi}`}
          x={cx - CELL / 2}
          y={cy - CELL / 2}
          width={CELL}
          height={CELL}
          fill={isHovered ? 'rgba(255,211,42,0.12)' : 'transparent'}
          stroke={isOccupied ? 'transparent' : '#1e293b'}
          strokeWidth={0.5}
        />,
      );
    }
  }

  // ── SVG transform ─────────────────────────────────────────────────────────────

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
        style={{ cursor: dragRef.current ? 'grabbing' : 'crosshair', touchAction: 'none' }}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="6"
            markerHeight="6"
            refX="3"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="#888" />
          </marker>
        </defs>

        <g transform={transform}>
          {/* Grid cells */}
          {gridCells}

          {/* Relationship lines */}
          {links.map((link) => (
            <RelationLine key={link.id} link={link} nodes={nodes} />
          ))}

          {/* Preview lines */}
          {hoveredCell &&
            previewLinks.map((p, i) => (
              <line
                key={`preview_${i}`}
                x1={gx(hoveredCell.x)}
                y1={gy(hoveredCell.y)}
                x2={gx(p.x)}
                y2={gy(p.y)}
                stroke={EmotionColors[p.emotion]}
                strokeWidth={1.5}
                strokeOpacity={0.45}
                strokeDasharray="6,4"
                style={{ pointerEvents: 'none' }}
              />
            ))}

          {/* Hovered cell highlight */}
          {hoveredCell && (
            <rect
              x={gx(hoveredCell.x) - CELL / 2}
              y={gy(hoveredCell.y) - CELL / 2}
              width={CELL}
              height={CELL}
              rx={8}
              fill="rgba(255,211,42,0.18)"
              stroke="#ffd32a"
              strokeWidth={1.5}
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Character nodes */}
          {nodes.map((node) => (
            <CharacterNodeView key={node.id} node={node} />
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
    </div>
  );
};
