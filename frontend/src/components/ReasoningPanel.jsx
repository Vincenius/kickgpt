import React, { useState } from 'react';

export default function ReasoningPanel({ tip }) {
  const [expanded, setExpanded] = useState(false);

  if (!tip) return null;

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tip.color }} />
          <span className="text-sm font-semibold text-white">{tip.display_name}</span>
          <span
            className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg"
            style={{ backgroundColor: `${tip.color}25`, color: tip.color }}
          >
            {tip.home}:{tip.away}
          </span>
          <ConfidenceBadge confidence={tip.confidence} color={tip.color} />
          {tip.points !== null && tip.points !== undefined && (
            <PointsBadge points={tip.points} type={tip.score_type} />
          )}
        </div>
      </div>

      {/* Summary – always visible */}
      {tip.summary && (
        <p className="text-sm text-gray-300 leading-relaxed pl-4 border-l-2" style={{ borderColor: `${tip.color}60` }}>
          {tip.summary}
        </p>
      )}

      {/* Full reasoning toggle */}
      {tip.reasoning && (
        <>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1 pl-4"
          >
            {expanded ? '▲ Collapse analysis' : '▼ Full analysis'}
          </button>
          {expanded && (
            <pre className="text-xs text-gray-400 bg-black/30 rounded-xl p-3 whitespace-pre-wrap break-words font-mono leading-relaxed animate-fade-in pl-4">
              {tip.reasoning}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence, color }) {
  if (!confidence) return null;
  const level = confidence >= 75 ? 'High' : confidence >= 50 ? 'Medium' : 'Low';
  return (
    <span className="text-xs text-gray-400" title={`Confidence: ${confidence}%`}>
      {confidence}% {level === 'High' ? '🔥' : level === 'Medium' ? '〰️' : '❓'}
    </span>
  );
}

function PointsBadge({ points, type }) {
  const config = {
    exact: { label: '4 pts ✨', cls: 'bg-yellow-500/20 text-yellow-400' },
    goal_diff: { label: '3 pts', cls: 'bg-blue-500/20 text-blue-400' },
    tendency: { label: '2 pts', cls: 'bg-violet-500/20 text-violet-400' },
    wrong: { label: '0 pts', cls: 'bg-red-500/20 text-red-400' },
  };
  const c = config[type] || { label: `${points} pts`, cls: 'bg-gray-500/20 text-gray-400' };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.cls}`}>{c.label}</span>;
}
