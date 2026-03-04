import React, { useEffect, useRef, useState } from 'react';
import { useStore } from './store/useStore';
import { TopBar } from './components/TopBar';
import { GridBoard } from './components/GridBoard';
import { BottomDrawer } from './components/BottomDrawer';
import { SetupModal } from './components/SetupModal';
import { ExportModal } from './components/ExportModal';
import { NameEditModal } from './components/NameEditModal';
import { CharacterNode, Personality } from './types';

const SVG_ID = 'fate-grid-svg';

export const App: React.FC = () => {
  const {
    nodes,
    links,
    nextCard,
    protagReady,
    initSession,
    setupProtag,
    placeCard,
    renameNode,
    reroll,
    reset,
  } = useStore();

  const [showExport, setShowExport]     = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [editingNode, setEditingNode]   = useState<CharacterNode | null>(null);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => { initSession(); }, [initSession]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleReset = () => {
    if (resetConfirm) {
      reset();
      setResetConfirm(false);
    } else {
      setResetConfirm(true);
      setTimeout(() => setResetConfirm(false), 3000);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar
        onReroll={reroll}
        onExport={() => setShowExport(true)}
        onReset={handleReset}
        nodeCount={nodes.length}
      />

      {resetConfirm && (
        <div className="bg-red-900/80 text-red-200 text-xs text-center py-1 px-3 shrink-0">
          한 번 더 누르면 초기화됩니다. 모든 데이터가 삭제됩니다.
        </div>
      )}

      <GridBoard
        id={SVG_ID}
        nodes={nodes}
        links={links}
        nextCard={nextCard}
        protagReady={protagReady}
        onPlaceCard={placeCard}
        onNodeEdit={(node: CharacterNode) => setEditingNode(node)}
      />

      <BottomDrawer
        nextCard={nextCard}
        nodeCount={nodes.length}
        protagReady={protagReady}
      />

      {!protagReady && <SetupModal onConfirm={(n: string, p: Personality) => setupProtag(n, p)} />}

      {showExport && (
        <ExportModal
          nodes={nodes}
          links={links}
          svgId={SVG_ID}
          onClose={() => setShowExport(false)}
        />
      )}

      {editingNode && (
        <NameEditModal
          node={editingNode}
          onSave={(id, name) => { renameNode(id, name); setEditingNode(null); }}
          onCancel={() => setEditingNode(null)}
          onValidationError={showToast}
        />
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-800 text-red-100 text-sm rounded-full shadow-lg pointer-events-none select-none">
          {toast}
        </div>
      )}
    </div>
  );
};
