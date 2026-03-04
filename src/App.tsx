import React, { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { TopBar } from './components/TopBar';
import { GridBoard } from './components/GridBoard';
import { BottomDrawer } from './components/BottomDrawer';
import { SetupModal } from './components/SetupModal';
import { ExportModal } from './components/ExportModal';
import { Personality } from './types';

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
    reroll,
    reset,
  } = useStore();

  const [showExport, setShowExport] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  // Restore or init session on mount
  useEffect(() => {
    initSession();
  }, [initSession]);

  const handleSetupProtag = (name: string, personality: Personality) => {
    setupProtag(name, personality);
  };

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
        <div className="bg-red-900/80 text-red-200 text-xs text-center py-1 px-3">
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
      />

      <BottomDrawer
        nextCard={nextCard}
        nodeCount={nodes.length}
        protagReady={protagReady}
      />

      {!protagReady && <SetupModal onConfirm={handleSetupProtag} />}

      {showExport && (
        <ExportModal
          nodes={nodes}
          links={links}
          svgId={SVG_ID}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
};
