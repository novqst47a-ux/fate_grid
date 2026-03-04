import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  CharacterNode,
  Link,
  Emotion,
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

const CELL         = 100; // px per grid unit (world coords)
const NODE_W       = 80;
const NODE_H       = 48;
const GRID_HALF    = 8;   // grid spans -8 to +8 in each axis
const CURVE_OFFSET = 22;  // world-px perpendicular offset for Type-3 curves
const ARROW_SIZE   = 9;   // arrowhead length in userSpaceOnUse px

/** Scale threshold below which text labels are hidden (LOD). */
const LOD_THRESHOLD = 0.6;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const wx = (x: number) => x * CELL;
const wy = (y: number) => y * CELL;

/**
 * Given a line from external point A toward node-center C,
 * returns the point on the node's rectangular boundary where the line enters.
 *
 * Parameterisation: P(t) = A + t*(C-A), t=0→A, t=1→C.
 * Crossing t* = max( 1 - hw/|ax-cx|,  1 - hh/|ay-cy|,  0 ).
 */
function rectEdge(
  ax: number, ay: number,
  cx: number, cy: number,
  hw = NODE_W / 2,
  hh = NODE_H / 2,
): { x: number; y: number } {
  const ddx = Math.abs(ax - cx);
  const ddy = Math.abs(ay - cy);
  const tx  = ddx < 0.001 ? 0 : 1 - hw / ddx;
  const ty  = ddy < 0.001 ? 0 : 1 - hh / ddy;
  const t   = Math.max(tx, ty, 0);
  return { x: ax + t * (cx - ax), y: ay + t * (cy - ay) };
}

/**
 * Compute a mildly-curved quadratic Bezier control point between two centers.
 * Curvature scales with world-space distance and is capped to stay subtle.
 *   sign =  1 → curves to the left of the A→B direction
 *   sign = -1 → curves to the right
 */
function mildCurveCP(
  cx1: number, cy1: number,
  cx2: number, cy2: number,
  sign: number,
): { cpX: number; cpY: number } {
  const dx   = cx2 - cx1;
  const dy   = cy2 - cy1;
  const dist = Math.hypot(dx, dy) || 1;
  // Perpendicular unit vector (90° counter-clockwise)
  const perpX = -dy / dist;
  const perpY =  dx / dist;
  // Curvature: grows with distance, capped so adjacent nodes stay clean
  const curveAmt = Math.min(dist * 0.07, 14);
  return {
    cpX: (cx1 + cx2) / 2 + sign * curveAmt * perpX,
    cpY: (cy1 + cy2) / 2 + sign * curveAmt * perpY,
  };
}

// ─── Arrow marker defs (one per emotion colour) ───────────────────────────────

const EMOTION_KEYS: Emotion[] = ['Love', 'Friendly', 'Hostile', 'Awkward'];

/**
 * SVG <marker> elements for arrowheads.
 *   markerUnits="userSpaceOnUse"  → absolute world-px sizes, zoom-stable
 *   refX = ARROW_SIZE             → tip aligns with the path endpoint
 *   Triangle: tip at (ARROW_SIZE, ARROW_SIZE/2), base at x=0
 */
const ArrowMarkerDefs: React.FC = () => (
  <>
    {EMOTION_KEYS.map((emotion) => (
      <marker
        key={emotion}
        id={`arrow-${emotion}`}
        markerWidth={ARROW_SIZE}
        markerHeight={ARROW_SIZE}
        refX={ARROW_SIZE}
        refY={ARROW_SIZE / 2}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <path
          d={`M0,0 L${ARROW_SIZE},${ARROW_SIZE / 2} L0,${ARROW_SIZE} Z`}
          fill={EmotionColors[emotion]}
        />
      </marker>
    ))}
  </>
);

// ─── Three-tiered RelationLine ────────────────────────────────────────────────

interface RelationLineProp {
  link: Link;
  nodes: CharacterNode[];
  /** Map of "from|to" → Link for O(1) reverse-link lookup. */
  linkMap: Map<string, Link>;
  /** ID of the currently-hovered node, or null if none. */
  hoveredNodeId: string | null;
  /** Current viewport scale — controls label LOD. */
  scale: number;
}

const TRANSITION = { transition: 'opacity 0.2s ease' };

const RelationLine: React.FC<RelationLineProp> = ({
  link, nodes, linkMap, hoveredNodeId, scale,
}) => {
  const fromNode = nodes.find((n) => n.id === link.from);
  const toNode   = nodes.find((n) => n.id === link.to);
  if (!fromNode || !toNode) return null;

  const cx1 = wx(fromNode.x), cy1 = wy(fromNode.y);
  const cx2 = wx(toNode.x),   cy2 = wy(toNode.y);

  const reverseLink = linkMap.get(`${link.to}|${link.from}`);
  const color       = EmotionColors[link.emotion];
  const arrowUrl    = `url(#arrow-${link.emotion})`;

  // ── Highlighting: dim links not connected to the hovered node ──────────────
  const isConnected =
    link.from === hoveredNodeId || link.to === hoveredNodeId;
  const opacity = hoveredNodeId === null ? 1 : (isConnected ? 1 : 0.1);

  // ── Level of Detail: hide text when zoomed out ────────────────────────────
  const showLabels = scale >= LOD_THRESHOLD;

  // ── Shared label props (halo stroke = 4 for readability) ──────────────────
  const lp = (x: number, y: number, c: string) => ({
    x, y,
    textAnchor:   'middle' as const,
    fontSize:     9,
    fill:         c,
    stroke:       '#0f0f1a',
    strokeWidth:  4,           // ← increased halo for cross-line readability
    paintOrder:   'stroke' as const,
    style:        TRANSITION,
  });

  // ────────────────────────────────────────────────────────────────────────
  // TYPE 1 — Bidirectional + SAME emotion: single curved line, no arrowheads.
  // Render only for the lexicographically forward direction to deduplicate.
  // ────────────────────────────────────────────────────────────────────────
  if (reverseLink && reverseLink.emotion === link.emotion) {
    if (link.from > link.to) return null;

    // Mild curve — sign=1 for the canonical (forward) direction
    const { cpX, cpY } = mildCurveCP(cx1, cy1, cx2, cy2, 1);
    const startPt = rectEdge(cpX, cpY, cx1, cy1);
    const endPt   = rectEdge(cpX, cpY, cx2, cy2);
    const pathD   = `M ${startPt.x},${startPt.y} Q ${cpX},${cpY} ${endPt.x},${endPt.y}`;

    // Label at Bezier midpoint t=0.5: B(½) = ¼·P0 + ½·CP + ¼·P1
    const labX = 0.25 * startPt.x + 0.5 * cpX + 0.25 * endPt.x;
    const labY = 0.25 * startPt.y + 0.5 * cpY + 0.25 * endPt.y - 7;

    const subA  = link.subCategory;
    const subB  = reverseLink.subCategory;
    const label = subA === subB ? subA : `${subA} · ${subB}`;

    return (
      <g style={{ opacity, ...TRANSITION }}>
        <path
          d={pathD}
          stroke={color}
          strokeWidth={2.5}
          strokeOpacity={0.85}
          fill="none"
          style={TRANSITION}
        />
        {showLabels && <text {...lp(labX, labY, color)}>{label}</text>}
      </g>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // TYPE 3 — Bidirectional + DIFFERENT emotions: two Bezier curves, arrows.
  // Opposite perpendicular offsets keep A→B and B→A visually separated.
  // ────────────────────────────────────────────────────────────────────────
  if (reverseLink) {
    const dx   = cx2 - cx1;
    const dy   = cy2 - cy1;
    const len  = Math.hypot(dx, dy) || 1;
    const perpX = -dy / len;
    const perpY =  dx / len;

    const sign = link.from < link.to ? 1 : -1;
    const cpX  = (cx1 + cx2) / 2 + sign * CURVE_OFFSET * perpX;
    const cpY  = (cy1 + cy2) / 2 + sign * CURVE_OFFSET * perpY;

    const startPt = rectEdge(cpX, cpY, cx1, cy1);
    const endPt   = rectEdge(cpX, cpY, cx2, cy2);
    const pathD   = `M ${startPt.x},${startPt.y} Q ${cpX},${cpY} ${endPt.x},${endPt.y}`;

    const labX = 0.25 * startPt.x + 0.5 * cpX + 0.25 * endPt.x;
    const labY = 0.25 * startPt.y + 0.5 * cpY + 0.25 * endPt.y - 5;

    return (
      <g style={{ opacity, ...TRANSITION }}>
        <path
          d={pathD}
          stroke={color}
          strokeWidth={2}
          strokeOpacity={0.85}
          fill="none"
          markerEnd={arrowUrl}
          style={TRANSITION}
        />
        {showLabels && (
          <text {...lp(labX, labY, color)}>{link.subCategory}</text>
        )}
      </g>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // TYPE 2 — One-sided: mildly-curved path with a single arrowhead.
  // Curvature direction alternates by lexicographic from/to order so that
  // multiple one-way edges on similar routes spread apart naturally.
  // ────────────────────────────────────────────────────────────────────────
  const sign2       = link.from < link.to ? 1 : -1;
  const { cpX: cp2X, cpY: cp2Y } = mildCurveCP(cx1, cy1, cx2, cy2, sign2);
  const startPt2    = rectEdge(cp2X, cp2Y, cx1, cy1);
  const endPt2      = rectEdge(cp2X, cp2Y, cx2, cy2);
  const pathD2      = `M ${startPt2.x},${startPt2.y} Q ${cp2X},${cp2Y} ${endPt2.x},${endPt2.y}`;

  const labX2 = 0.25 * startPt2.x + 0.5 * cp2X + 0.25 * endPt2.x;
  const labY2 = 0.25 * startPt2.y + 0.5 * cp2Y + 0.25 * endPt2.y - 5;

  return (
    <g style={{ opacity, ...TRANSITION }}>
      <path
        d={pathD2}
        stroke={color}
        strokeWidth={2}
        strokeOpacity={0.85}
        fill="none"
        markerEnd={arrowUrl}
        style={TRANSITION}
      />
      {showLabels && (
        <text {...lp(labX2, labY2, color)}>{link.subCategory}</text>
      )}
    </g>
  );
};

// ─── Character node card ──────────────────────────────────────────────────────

interface CharacterNodeViewProps {
  node: CharacterNode;
  /** Current viewport scale — controls secondary-label LOD. */
  scale: number;
  onEdit: (node: CharacterNode) => void;
  onHoverEnter: (id: string) => void;
  onHoverLeave: () => void;
}

const LONG_PRESS_MS = 500;

const CharacterNodeView: React.FC<CharacterNodeViewProps> = ({
  node, scale, onEdit, onHoverEnter, onHoverLeave,
}) => {
  const cx    = wx(node.x);
  const cy    = wy(node.y);
  const color = PositionColors[node.position];

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLP = () => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <g
      transform={`translate(${cx}, ${cy})`}
      style={{ pointerEvents: 'all', cursor: 'pointer' }}
      onDoubleClick={(e) => { e.stopPropagation(); onEdit(node); }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={() => onHoverEnter(node.id)}
      onMouseLeave={() => onHoverLeave()}
      onTouchStart={(e) => {
        e.stopPropagation();
        longPressTimer.current = setTimeout(() => {
          longPressTimer.current = null;
          onEdit(node);
        }, LONG_PRESS_MS);
      }}
      onTouchEnd={(e) => { e.stopPropagation(); clearLP(); }}
      onTouchMove={(e) => { e.stopPropagation(); clearLP(); }}
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
      {/* Primary label — always visible */}
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
      {/* Secondary label — hidden when zoomed out (LOD) */}
      {scale >= LOD_THRESHOLD && (
        <text
          y={10}
          textAnchor="middle"
          fontSize={9}
          fill="#333"
          dominantBaseline="middle"
        >
          {PositionLabels[node.position]} · {PersonalityLabels[node.personality]}
        </text>
      )}
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
  const svgRef       = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Pan / zoom ──
  const [tx, setTx]       = useState(0);
  const [ty, setTy]       = useState(0);
  const [scale, setScale] = useState(1);

  // ── Hover / preview ──
  const [hoveredCell, setHoveredCell]     = useState<{ x: number; y: number } | null>(null);
  const [previewLinks, setPreviewLinks]   = useState<PreviewCandidate[]>([]);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // ── Drag state ──
  const dragRef  = useRef<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null);
  const touchRef = useRef<{ id: number; x: number; y: number }[]>([]);
  const pinchRef = useRef<number | null>(null);

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

    if (!dr) return;

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
    setHoveredNodeId(null);
    setHoveredCell(null);
    setPreviewLinks([]);
  };

  // ── Wheel zoom ────────────────────────────────────────────────────────────

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const pos    = getPointerSVG(e);
    if (!pos) return;
    const factor   = e.deltaY < 0 ? 1.12 : 1 / 1.12;
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
      dragRef.current  = null;
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
      const dx     = touches[1].x - touches[0].x;
      const dy     = touches[1].y - touches[0].y;
      const dist   = Math.hypot(dx, dy);
      const factor = dist / pinchRef.current;
      const midX   = (touches[0].x + touches[1].x) / 2;
      const midY   = (touches[0].y + touches[1].y) / 2;
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
      const t    = e.changedTouches[0];
      const endX = t.clientX - rect.left;
      const endY = t.clientY - rect.top;
      const dx   = Math.abs(endX - dragRef.current.startX);
      const dy   = Math.abs(endY - dragRef.current.startY);

      if (dx < 10 && dy < 10 && protagReady && nextCard && nodes.length < 27) {
        const grid = svgToGrid(endX, endY);
        onPlaceCard(grid.x, grid.y);
      }
    }

    dragRef.current  = null;
    pinchRef.current = null;
    touchRef.current = [];
    setHoveredCell(null);
    setPreviewLinks([]);
  };

  // ── Build linkMap for three-tier RelationLine logic ───────────────────────

  const linkMap = new Map(links.map((l) => [`${l.from}|${l.to}`, l]));

  // ── Grid cell rendering ───────────────────────────────────────────────────

  const gridCells: React.ReactNode[] = [];
  for (let gxi = -GRID_HALF; gxi <= GRID_HALF; gxi++) {
    for (let gyi = -GRID_HALF; gyi <= GRID_HALF; gyi++) {
      const cx    = wx(gxi);
      const cy    = wy(gyi);
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
        {/* Arrow marker definitions — one per emotion colour */}
        <defs>
          <ArrowMarkerDefs />
        </defs>

        <g transform={transform}>
          {/* Grid cells */}
          {gridCells}

          {/* Relationship lines (below nodes) — pass hover + scale for LOD/dimming */}
          {links.map((link) => (
            <RelationLine
              key={link.id}
              link={link}
              nodes={nodes}
              linkMap={linkMap}
              hoveredNodeId={hoveredNodeId}
              scale={scale}
            />
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

          {/* Character nodes (on top) — hover handlers update hoveredNodeId */}
          {nodes.map((node) => (
            <CharacterNodeView
              key={node.id}
              node={node}
              scale={scale}
              onEdit={onNodeEdit}
              onHoverEnter={setHoveredNodeId}
              onHoverLeave={() => setHoveredNodeId(null)}
            />
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
