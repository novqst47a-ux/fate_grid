import React, { useState } from 'react';
import { Personality, PersonalityLabels } from '../types';

const PERSONALITIES: Personality[] = [
  'SOCIAL', 'BRIGHT', 'INTRO', 'CYNICAL',
  'MAD', 'CALM', 'AGGRESSIVE', 'TIMID',
];

interface SetupModalProps {
  onConfirm: (name: string, personality: Personality) => void;
}

export const SetupModal: React.FC<SetupModalProps> = ({ onConfirm }) => {
  const [name, setName] = useState('');
  const [personality, setPersonality] = useState<Personality>('SOCIAL');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || '주인공';
    onConfirm(finalName, personality);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-yellow-300 font-bold text-lg text-center mb-1">FATE GRID</h2>
        <p className="text-gray-400 text-sm text-center mb-5">주인공을 설정하세요</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="주인공"
              maxLength={20}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-2">성격</label>
            <div className="grid grid-cols-4 gap-2">
              {PERSONALITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPersonality(p)}
                  className={`py-1.5 rounded text-xs font-semibold transition-colors ${
                    personality === p
                      ? 'bg-yellow-400 text-gray-900'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {PersonalityLabels[p]}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold rounded-lg transition-colors"
          >
            시작하기
          </button>
        </form>
      </div>
    </div>
  );
};
