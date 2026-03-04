import React, { useState } from 'react';
import {
  CharacterNode,
  Link,
  PositionLabels,
  EmotionLabels,
} from '../types';

// html-to-image is loaded lazily to avoid SSR issues
async function exportPNG(svgId: string): Promise<void> {
  const { toPng } = await import('html-to-image');
  const el = document.getElementById(svgId);
  if (!el) return;
  const dataUrl = await toPng(el, { backgroundColor: '#0f0f1a' });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'fate-grid.png';
  a.click();
}

function exportSVG(svgId: string): void {
  const el = document.getElementById(svgId) as SVGSVGElement | null;
  if (!el) return;
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(el);
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fate-grid.svg';
  a.click();
  URL.revokeObjectURL(url);
}

/** Generate a Korean narrative text report from the link data. */
function buildReport(nodes: CharacterNode[], links: Link[]): string {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const lines: string[] = ['[FATE GRID 관계 보고서]', ''];

  for (const link of links) {
    const from = nodeMap.get(link.from);
    const to = nodeMap.get(link.to);
    if (!from || !to) continue;

    const fromName = from.name || PositionLabels[from.position];
    const toName = to.name || PositionLabels[to.position];
    const emotionKo = EmotionLabels[link.emotion];
    lines.push(
      `${fromName}(${PositionLabels[from.position]})은(는) ${toName}(${PositionLabels[to.position]})에게 ${emotionKo}(${link.subCategory})의 감정을 가지고 있다.`,
    );
  }

  if (links.length === 0) {
    lines.push('아직 관계가 형성되지 않았습니다.');
  }

  return lines.join('\n');
}

interface ExportModalProps {
  nodes: CharacterNode[];
  links: Link[];
  svgId: string;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  nodes,
  links,
  svgId,
  onClose,
}) => {
  const [copying, setCopying] = useState(false);
  const report = buildReport(nodes, links);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(report);
    setCopying(true);
    setTimeout(() => setCopying(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-full max-w-md shadow-2xl flex flex-col gap-4 max-h-[90vh]">
        <div className="flex items-center justify-between">
          <h2 className="text-emerald-400 font-bold text-base">Export</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Image export buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => exportPNG(svgId)}
            className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm rounded-lg font-semibold transition-colors"
          >
            PNG 저장
          </button>
          <button
            onClick={() => exportSVG(svgId)}
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg font-semibold transition-colors"
          >
            SVG 저장
          </button>
        </div>

        {/* Text report */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">텍스트 보고서</span>
            <button
              onClick={handleCopy}
              className="text-xs px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
            >
              {copying ? '복사됨!' : '복사'}
            </button>
          </div>
          <textarea
            readOnly
            value={report}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 resize-none focus:outline-none"
            rows={12}
          />
        </div>
      </div>
    </div>
  );
};
