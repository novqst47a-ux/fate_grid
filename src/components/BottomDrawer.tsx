import React from 'react';
import { NextCard, PositionLabels, PersonalityLabels, PositionColors } from '../types';

interface BottomDrawerProps {
  nextCard: NextCard | null;
  nodeCount: number;
  protagReady: boolean;
}

export const BottomDrawer: React.FC<BottomDrawerProps> = ({
  nextCard,
  nodeCount,
  protagReady,
}) => {
  if (!protagReady) {
    return (
      <div className="shrink-0 bg-gray-900 border-t border-gray-700 px-4 py-3 text-center text-sm text-gray-400">
        주인공 이름과 성격을 설정해주세요.
      </div>
    );
  }

  if (nodeCount >= 27) {
    return (
      <div className="shrink-0 bg-gray-900 border-t border-gray-700 px-4 py-3 text-center text-sm text-yellow-400 font-semibold">
        최대 27명의 캐릭터가 배치되었습니다.
      </div>
    );
  }

  if (!nextCard) return null;

  const posColor = PositionColors[nextCard.position];

  return (
    <div className="shrink-0 bg-gray-900 border-t border-gray-700 px-4 py-3">
      <p className="text-xs text-gray-400 mb-2 text-center">
        빈 칸을 탭하여 다음 카드를 배치하세요
      </p>
      <div className="flex items-center justify-center gap-3">
        <div
          className="rounded-lg px-4 py-2 text-center font-bold text-gray-900 text-sm shadow-lg"
          style={{ background: posColor, minWidth: 120 }}
        >
          <div className="text-base">{PositionLabels[nextCard.position]}</div>
          <div className="text-xs font-normal mt-0.5 opacity-75">
            {PersonalityLabels[nextCard.personality]}
          </div>
        </div>
        <div className="text-xs text-gray-500 text-left leading-relaxed">
          <div>• 빈 셀 터치 = 배치</div>
          <div>• 핀치/휠 = 줌</div>
          <div>• 드래그 = 이동</div>
        </div>
      </div>
    </div>
  );
};
