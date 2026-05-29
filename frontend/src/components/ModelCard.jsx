import React from 'react';

function StatRow({ label, value, sub }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-900">
        {value ?? <span className="text-gray-300">—</span>}
        {sub && <span className="text-gray-400 font-normal ml-1 text-xs">{sub}</span>}
      </span>
    </div>
  );
}

function TipPreview({ label, tip, color }) {
  if (!tip) return null;
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: `${color}10` }}>
      <div className="text-xs font-medium mb-1" style={{ color }}>
        {label}
      </div>
      <div className="text-sm text-gray-900 font-semibold">
        {tip.home_team} {tip.home}:{tip.away} {tip.away_team}
      </div>
      {tip.points !== null && tip.points !== undefined && (
        <div className="text-xs mt-1" style={{ color }}>
          {tip.points} pts
        </div>
      )}
    </div>
  );
}

export default function ModelCard({ model }) {
  const winRate = model.scored_matches
    ? Math.round(((model.exact_count + model.goal_diff_count + model.tendency_count) / model.scored_matches) * 100)
    : null;

  const exactRate = model.scored_matches
    ? Math.round((model.exact_count / model.scored_matches) * 100)
    : null;

  return (
    <div
      className="card p-5 flex flex-col gap-4 hover:shadow-md transition-shadow"
      style={{ borderLeftWidth: '3px', borderLeftColor: model.color }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl shrink-0"
          style={{ backgroundColor: `${model.color}20` }}
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-gray-900 text-base leading-tight">{model.display_name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">Rank #{model.rank}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-3xl font-extrabold tabular-nums" style={{ color: model.color }}>
            {model.total_points}
          </div>
          <div className="text-xs text-gray-400 text-right">pts</div>
        </div>
      </div>

      <div className="space-y-2 border-t border-gray-100 pt-3">
        <StatRow label="Predictions" value={model.tips_count} />
        <StatRow label="Avg. confidence" value={model.avg_confidence ? `${model.avg_confidence}%` : null} />
        <StatRow label="Accuracy" value={winRate !== null ? `${winRate}%` : null} />
        <StatRow label="Exact scores" value={model.exact_count} sub={exactRate !== null ? `(${exactRate}%)` : ''} />
        <StatRow label="Goal difference" value={model.goal_diff_count} />
        <StatRow label="Correct tendency" value={model.tendency_count} />
        <StatRow label="Wrong" value={model.wrong_count} />
      </div>

      {(model.best_tip || model.worst_tip) && (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <TipPreview label="Best prediction" tip={model.best_tip} color={model.color} />
          <TipPreview label="Worst prediction" tip={model.worst_tip} color="#9CA3AF" />
        </div>
      )}
    </div>
  );
}
