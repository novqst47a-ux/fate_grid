import React from 'react';

interface TopBarProps {
  onReroll: () => void;
  onExport: () => void;
  onReset: () => void;
  nodeCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  onReroll,
  onExport,
  onReset,
  nodeCount,
}) => {
  return (
    <header className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-700 shrink-0">
      <div className="flex items-center gap-2">
        <span className="font-bold text-base tracking-widest text-yellow-300">
          FATE GRID
        </span>
        <span className="text-xs text-gray-400">{nodeCount}/27</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onReroll}
          className="px-3 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold transition-colors"
        >
          Reroll
        </button>
        <button
          onClick={onExport}
          className="px-3 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold transition-colors"
        >
          Export
        </button>
        <button
          onClick={onReset}
          className="px-3 py-1 text-xs rounded bg-red-700 hover:bg-red-600 active:bg-red-800 text-white font-semibold transition-colors"
        >
          Reset
        </button>
      </div>
    </header>
  );
};
