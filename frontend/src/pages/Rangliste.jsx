import React, { useEffect, useState } from 'react';

const STAGE_LABELS = {
  group: 'Group Stage', r32: 'R32', r16: 'R16',
  qf: 'QF', sf: 'SF', final: 'Final', '3rd': '3rd Place',
};

function useFetch(url, interval = 60000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(url)
        .then(r => r.json())
        .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
        .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });

    load();
    const timer = setInterval(load, interval);
    return () => { cancelled = true; clearInterval(timer); };
  }, [url, interval]);

  return { data, loading, error };
}

function Sparkline({ points, color, width = 120, height = 36 }) {
  if (!points || points.length < 2) return <span className="text-xs text-gray-600">No data yet</span>;

  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const xs = points.map((_, i) => (i / (points.length - 1)) * width);
  const ys = points.map(v => height - ((v - min) / range) * (height - 4) - 2);
  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ys[i]}`).join(' ');

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3" fill={color} />
    </svg>
  );
}

function TrendArrow({ trend }) {
  if (trend > 0) return <span className="text-emerald-400 text-lg font-bold">↑</span>;
  if (trend < 0) return <span className="text-red-400 text-lg font-bold">↓</span>;
  return <span className="text-gray-500 text-lg">→</span>;
}

function LeaderCard({ model, gap }) {
  if (!model) return (
    <div className="card p-6 text-center text-gray-500">
      <div className="text-4xl mb-2">🏆</div>
      <p className="font-medium">No matches scored yet</p>
      <p className="text-sm mt-1">Run tips to get the competition started</p>
    </div>
  );

  return (
    <div
      className="card p-5 flex items-center gap-4"
      style={{
        background: `linear-gradient(135deg, ${model.bg_color || '#1A1A2E'} 0%, #131320 100%)`,
        borderColor: `${model.color}40`,
      }}
    >
      <div className="shrink-0">
        <div className="text-5xl font-extrabold" style={{ color: model.color }}>#1</div>
        <div className="text-xs text-gray-500 mt-1 text-center">Leading</div>
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-xl font-extrabold text-white leading-tight">{model.display_name}</h2>
        <p className="text-sm mt-0.5" style={{ color: model.color }}>
          {model.tagline?.split(' – ')[1] || model.tagline}
        </p>
      </div>
      <div className="text-right shrink-0">
        <div className="text-4xl font-extrabold tabular-nums text-white">{model.total_points}</div>
        <div className="text-xs text-gray-500 mt-0.5">Points</div>
        {gap > 0 && (
          <div className="text-xs mt-1" style={{ color: model.color }}>+{gap} ahead of #2</div>
        )}
      </div>
    </div>
  );
}

function MiniLeaderboard({ models }) {
  if (!models || !models.length) return null;
  return (
    <div className="card divide-y divide-white/5">
      {models.map((m, i) => (
        <div key={m.id} className={`flex items-center gap-3 px-4 py-3 ${i === 0 ? 'bg-white/3' : ''}`}>
          <span className="text-gray-500 font-mono text-sm w-5 shrink-0">#{i + 1}</span>
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-white text-sm truncate block">{m.display_name}</span>
            <span className="text-xs text-gray-500 truncate block">{m.tagline?.split(' – ')[0]}</span>
          </div>
          <TrendArrow trend={m.trend} />
          <span className="font-bold tabular-nums text-white text-sm w-14 text-right shrink-0">
            {m.total_points} <span className="text-gray-500 font-normal text-xs">pts</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function SurpriseTip({ tip }) {
  if (!tip) return null;
  return (
    <div className="card p-4 border-l-4" style={{ borderColor: tip.model_color }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">😮</span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Most Surprising Tip Today</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-white">{tip.match}</span>
        <span className="font-mono text-lg font-extrabold" style={{ color: tip.model_color }}>{tip.tip}</span>
        <span className="text-sm text-gray-400">by {tip.model_name}</span>
        <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
          +{tip.deviation} goals from consensus
        </span>
      </div>
      {tip.summary && (
        <p className="text-sm text-gray-400 mt-2 leading-relaxed">{tip.summary}</p>
      )}
    </div>
  );
}

function PointsTimeline({ timeline, models }) {
  if (!timeline || !timeline.length || !models) return (
    <div className="text-sm text-gray-500 italic">No matches scored yet</div>
  );

  const byModel = {};
  for (const entry of timeline) {
    if (!byModel[entry.model_id]) byModel[entry.model_id] = [];
    byModel[entry.model_id].push(entry.cumulative_points);
  }

  return (
    <div className="card p-4">
      <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-4">Points Over Time</div>
      <div className="space-y-3">
        {models.map(m => (
          <div key={m.id} className="flex items-center gap-3">
            <div className="w-24 shrink-0">
              <div className="text-xs font-medium truncate" style={{ color: m.color }}>
                {m.display_name.split(' ')[0]}
              </div>
            </div>
            <Sparkline points={byModel[m.id] || [0]} color={m.color} />
            <span className="text-sm font-bold tabular-nums text-white w-10 text-right shrink-0">
              {m.total_points}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StageBreakdown({ byStage, models }) {
  if (!byStage || !byStage.length || !models) return null;

  const stages = [...new Set(byStage.map(r => r.stage))];

  return (
    <div className="card p-4">
      <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-4">Points by Stage</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs">
              <th className="text-left pb-2 font-medium">Model</th>
              {stages.map(s => (
                <th key={s} className="text-right pb-2 font-medium">{STAGE_LABELS[s] || s}</th>
              ))}
              <th className="text-right pb-2 font-semibold text-white">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {models.map(m => {
              const stageMap = Object.fromEntries(
                byStage.filter(r => r.model_id === m.id).map(r => [r.stage, r.points])
              );
              return (
                <tr key={m.id}>
                  <td className="py-2 font-medium" style={{ color: m.color }}>{m.display_name.split(' ')[0]}</td>
                  {stages.map(s => (
                    <td key={s} className="py-2 text-right text-gray-300 tabular-nums">{stageMap[s] || 0}</td>
                  ))}
                  <td className="py-2 text-right font-bold text-white tabular-nums">{m.total_points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Rangliste() {
  const { data, loading, error } = useFetch('/api/leaderboard', 30000);

  if (loading) return (
    <div className="pt-8 space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card h-20 animate-pulse bg-white/3" />
      ))}
    </div>
  );

  if (error) return (
    <div className="pt-8 text-center text-red-400">
      <div className="text-4xl mb-3">⚠️</div>
      <p>Error loading data: {error}</p>
      <p className="text-sm text-gray-500 mt-2">Is the backend server running?</p>
    </div>
  );

  const { leader, gap, models, by_stage, surprise_tip, timeline } = data || {};

  return (
    <div className="pt-4 space-y-4 animate-fade-in">
      <LeaderCard model={leader} gap={gap} />
      <MiniLeaderboard models={models} />
      {surprise_tip && <SurpriseTip tip={surprise_tip} />}

      <div className="pt-4 space-y-4">
        <PointsTimeline timeline={timeline} models={models} />
        <StageBreakdown byStage={by_stage} models={models} />
      </div>
    </div>
  );
}
