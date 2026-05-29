import React from 'react';

function TipOutcome({ tip, homeScore, awayScore, isFinished }) {
  if (!tip) return null;

  let label = '';
  let cls = '';

  if (isFinished) {
    const td = tip.home - tip.away, rd = homeScore - awayScore;
    if (tip.home === homeScore && tip.away === awayScore) { label = '4 pts'; cls = 'text-yellow-600'; }
    else if (td === rd) { label = '3 pts'; cls = 'text-blue-600'; }
    else if (Math.sign(td) === Math.sign(rd)) { label = '2 pts'; cls = 'text-violet-600'; }
    else { label = '0 pts'; cls = 'text-red-500'; }
  } else {
    const td = tip.home - tip.away;
    const curDiff = homeScore - awayScore;
    const goalsLeft = Math.max(8 - homeScore - awayScore, 0);
    const canStillMatch = Math.abs(td - curDiff) <= goalsLeft;

    if (!canStillMatch) { label = 'No longer possible'; cls = 'text-red-400'; }
    else { label = 'Still possible'; cls = 'text-amber-600'; }
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tip.color }} />
        <span className="text-sm font-semibold text-gray-900">{tip.display_name}</span>
        <span className="font-mono text-sm" style={{ color: tip.color }}>{tip.home}:{tip.away}</span>
      </div>
      <span className={`text-xs font-semibold ${cls}`}>{label}</span>
    </div>
  );
}

export default function LiveTicker({ matches }) {
  if (!matches || matches.length === 0) return null;

  return (
    <div className="space-y-3">
      {matches.map(match => (
        <div key={match.id} className="card p-4 ring-1 ring-red-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="font-bold text-gray-900">{match.home_team}</span>
              <div className="text-center">
                <div className="text-3xl font-extrabold tabular-nums text-red-500">
                  {match.home_score ?? 0}:{match.away_score ?? 0}
                </div>
                {match.minute && (
                  <div className="text-xs text-red-400 font-semibold">{match.minute}'</div>
                )}
              </div>
              <span className="font-bold text-gray-900">{match.away_team}</span>
            </div>
            <span className="badge-live">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              {match.status === 'PAUSED' ? 'HT' : 'LIVE'}
            </span>
          </div>

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
  );
}
