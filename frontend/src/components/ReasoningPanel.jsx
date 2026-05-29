import React, { useState } from 'react';

export default function ReasoningPanel({ tip }) {
  const [expanded, setExpanded] = useState(false);
  if (!tip) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tip.color }} />
        <span className="text-sm font-semibold text-gray-900">{tip.display_name}</span>
        <span
          className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg"
          style={{ backgroundColor: `${tip.color}15`, color: tip.color }}
        >
          {tip.home}:{tip.away}
        </span>
        <ConfidenceBadge confidence={tip.confidence} />
        {tip.points !== null && tip.points !== undefined && (
          <PointsBadge points={tip.points} type={tip.score_type} />
        )}
      </div>

      {tip.summary && (
        <p className="text-sm text-gray-600 leading-relaxed pl-4 border-l-2" style={{ borderColor: `${tip.color}50` }}>
          {tip.summary}
        </p>
      )}

      {tip.reasoning && (
        <>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 pl-4"
          >
            {expanded ? '▲ Collapse' : '▼ Full analysis'}
          </button>
          {expanded && (
            <pre className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-3 whitespace-pre-wrap break-words font-mono leading-relaxed animate-fade-in">
              {tip.reasoning}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence }) {
  if (!confidence) return null;
  return (
    <span className="text-xs text-gray-400">{confidence}%</span>
  );
}

function PointsBadge({ points, type }) {
  const config = {
    exact: { label: '4 pts', cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
    goal_diff: { label: '3 pts', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
    tendency: { label: '2 pts', cls: 'bg-violet-50 text-violet-700 border border-violet-200' },
    wrong: { label: '0 pts', cls: 'bg-red-50 text-red-600 border border-red-200' },
  };
  const c = config[type] || { label: `${points} pts`, cls: 'bg-gray-50 text-gray-600 border border-gray-200' };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.cls}`}>{c.label}</span>;
}
