import React from 'react';
import ReasoningPanel from './ReasoningPanel.jsx';

function TipOutcome({ tip, homeScore, awayScore, isFinished }) {
  if (!tip) return null;

  let status = 'open';
  let label = '';
  let cls = '';

  if (isFinished) {
    const td = tip.home - tip.away, rd = homeScore - awayScore;
    if (tip.home === homeScore && tip.away === awayScore) { status = 'exact'; label = '4 Pkt ✨'; cls = 'text-yellow-400'; }
    else if (td === rd) { status = 'goal_diff'; label = '3 Pkt'; cls = 'text-blue-400'; }
    else if (Math.sign(td) === Math.sign(rd)) { status = 'tendency'; label = '2 Pkt'; cls = 'text-violet-400'; }
    else { status = 'wrong'; label = '0 Pkt'; cls = 'text-red-400'; }
  } else {
    // Still playing: check if tip is still possible
    const td = tip.home - tip.away;
    const curDiff = homeScore - awayScore;
    const goalsLeft = Math.max(8 - homeScore - awayScore, 0);
    const canStillMatch = Math.abs(td - curDiff) <= goalsLeft;

    if (!canStillMatch) { status = 'impossible'; label = 'No longer possible'; cls = 'text-red-400/70'; }
    else { label = 'Still possible'; cls = 'text-amber-400'; }
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tip.color }} />
        <span className="text-sm font-semibold">{tip.display_name}</span>
        <span className="font-mono text-sm" style={{ color: tip.color }}>{tip.home}:{tip.away}</span>
      </div>
      <span className={`text-xs font-semibold ${cls}`}>{label}</span>
    </div>
  );
}

export default function LiveTicker({ matches }) {
  if (!matches || matches.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="badge-live">
          <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
          LIVE
        </span>
        <span className="text-sm text-gray-400">{matches.length} match{matches.length !== 1 ? 'es' : ''} in progress</span>
      </div>

      <div className="space-y-3">
        {matches.map(match => (
          <div key={match.id} className="card p-4 ring-1 ring-red-500/30">
            {/* Score */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="font-bold text-white">{match.home_team}</span>
                <div className="text-center">
                  <div className="text-3xl font-extrabold tabular-nums text-red-400">
                    {match.home_score ?? 0}:{match.away_score ?? 0}
                  </div>
                  {match.minute && (
                    <div className="text-xs text-red-400/70 font-semibold">{match.minute}'</div>
                  )}
                </div>
                <span className="font-bold text-white">{match.away_team}</span>
              </div>
              <span className="badge-live">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                {match.status === 'PAUSED' ? 'HT' : 'LIVE'}
              </span>
            </div>

            {/* Model tips vs current score */}
            <div className="space-y-2">
              {(match.tips || []).map(tip => (
                <TipOutcome
                  key={tip.model_id}
                  tip={tip}
                  homeScore={match.home_score}
                  awayScore={match.away_score}
                  isFinished={false}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
