import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

const mdComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-gray-700">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => <h2 className="font-bold text-gray-800 text-xs uppercase tracking-wide mt-3 mb-1 first:mt-0">{children}</h2>,
  h2: ({ children }) => <h2 className="font-bold text-gray-800 text-xs uppercase tracking-wide mt-3 mb-1 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="font-semibold text-gray-700 mt-2 mb-0.5 first:mt-0">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  a: ({ href, children }) => <a href={href} className="text-blue-500 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
  code: ({ children }) => <code className="bg-gray-100 px-1 rounded font-mono text-[11px]">{children}</code>,
  hr: () => <hr className="border-gray-200 my-2" />,
};

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
            <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-3 leading-relaxed animate-fade-in">
              <ReactMarkdown components={mdComponents}>{tip.reasoning}</ReactMarkdown>
            </div>
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
