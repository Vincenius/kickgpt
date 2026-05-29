import React from 'react';

function StatRow({ label, value, sub }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="font-semibold text-white">
        {value ?? <span className="text-gray-600">–</span>}
        {sub && <span className="text-gray-500 font-normal ml-1 text-xs">{sub}</span>}
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
      <div className="text-sm text-white font-semibold">
        {tip.home_team} {tip.home}:{tip.away} {tip.away_team}
      </div>
      {tip.points !== null && tip.points !== undefined && (
        <div className="text-xs mt-1" style={{ color }}>
          {tip.points} Punkte erzielt
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
    <div className="card p-5 flex flex-col gap-4 hover:ring-1 transition-all" style={{ '--tw-ring-color': `${model.color}40` }}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: model.bg_color || `${model.color}20` }}>
          {modelEmoji(model.api_type)}
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-white text-lg leading-tight">{model.display_name}</h3>
          <p className="text-sm font-medium mt-0.5" style={{ color: model.color }}>
            {model.tagline?.split(' – ')[0]}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {model.tagline?.split(' – ')[1]}
          </p>
        </div>
      </div>

      {/* Points big */}
      <div className="flex items-end gap-3">
        <div>
          <div className="text-4xl font-extrabold tabular-nums" style={{ color: model.color }}>
            {model.total_points}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Total Points</div>
        </div>
        <div className="pb-1 text-gray-600 text-lg">|</div>
        <div>
          <div className="text-2xl font-bold text-white tabular-nums">#{model.rank}</div>
          <div className="text-xs text-gray-500 mt-0.5">Rank</div>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2 border-t border-white/5 pt-3">
        <StatRow label="Predictions Made" value={model.tips_count} />
        <StatRow label="Avg. Confidence" value={model.avg_confidence ? `${model.avg_confidence}%` : null} />
        <StatRow label="Accuracy" value={winRate !== null ? `${winRate}%` : null} />
        <StatRow label="Exact Scores" value={model.exact_count} sub={exactRate !== null ? `(${exactRate}%)` : ''} />
        <StatRow label="Goal Difference" value={model.goal_diff_count} />
        <StatRow label="Correct Tendency" value={model.tendency_count} />
        <StatRow label="Wrong" value={model.wrong_count} />
      </div>

      {/* Best / Worst tip */}
      {(model.best_tip || model.worst_tip) && (
        <div className="space-y-2 border-t border-white/5 pt-3">
          <TipPreview label="Best Prediction" tip={model.best_tip} color={model.color} />
          <TipPreview label="Worst Prediction" tip={model.worst_tip} color="#6B7280" />
        </div>
      )}
    </div>
  );
}

function modelEmoji(apiType) {
  return { claude: '🟣', gpt: '🟢', gemini: '🔵', grok: '🟠', terminator: '🤖' }[apiType] || '🤖';
}
