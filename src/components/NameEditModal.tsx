import React, { useState, useRef, useEffect } from 'react';
import { CharacterNode, PositionLabels, PersonalityLabels, PositionColors } from '../types';

interface NameEditModalProps {
  node: CharacterNode;
  onSave: (id: string, name: string) => void;
  onCancel: () => void;
  onValidationError: (msg: string) => void;
}

export const NameEditModal: React.FC<NameEditModalProps> = ({
  node,
  onSave,
  onCancel,
  onValidationError,
}) => {
  const [value, setValue] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input
  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      onValidationError('이름은 비워둘 수 없습니다.');
      return;
    }
    onSave(node.id, trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onCancel();
  };

  const badgeColor = PositionColors[node.position];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-full max-w-xs shadow-2xl">
        {/* Character badge */}
        <div className="flex items-center gap-2 mb-4">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full text-gray-900"
            style={{ background: badgeColor }}
          >
            {PositionLabels[node.position]}
          </span>
          <span className="text-xs text-gray-400">{PersonalityLabels[node.personality]}</span>
        </div>

        <label className="block text-xs text-gray-400 mb-1">캐릭터 이름 편집</label>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={24}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400 mb-4"
        />

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold text-sm rounded-lg transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};
