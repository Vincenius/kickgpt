import React, { useState } from 'react';
import ConsensusBar from './ConsensusBar.jsx';
import ReasoningPanel from './ReasoningPanel.jsx';

const STAGE_LABELS = {
  group: 'Group Stage',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-final',
  sf: 'Semi-final',
  final: 'Final',
  '3rd': '3rd Place',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' });
}

function StatusPill({ status, minute }) {
  if (status === 'IN_PLAY') return (
    <span className="badge-live">
      <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
      LIVE {minute ? `${minute}'` : ''}
    </span>
  );
  if (status === 'PAUSED') return (
    <span className="badge-live">⏸ Half Time</span>
  );
  if (status === 'FINISHED') return (
    <span className="inline-flex items-center text-xs text-gray-500 font-medium">Full Time</span>
  );
  return null;
}

export default function MatchCard({ match, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const isFinished = match.status === 'FINISHED';
  const hasTips = match.tips && match.tips.length > 0;

  return (
    <div className={`card overflow-hidden transition-shadow ${isLive ? 'ring-1 ring-red-500/40' : ''}`}>
      {/* Match header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left p-4 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          {/* Teams + Score */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="font-semibold text-white truncate">{match.home_team}</span>
              {isFinished || isLive ? (
                <span className="text-xl font-extrabold tabular-nums shrink-0">
                  <span className={isLive ? 'text-red-400' : 'text-white'}>
                    {match.home_score ?? '–'}:{match.away_score ?? '–'}
                  </span>
                </span>
              ) : (
                <span className="text-gray-500 text-sm shrink-0">vs</span>
              )}
              <span className="font-semibold text-white truncate">{match.away_team}</span>
            </div>
          </div>

          {/* Right side: meta */}
          <div className="flex items-center gap-2 shrink-0">
            <StatusPill status={match.status} minute={match.minute} />
            {!isLive && !isFinished && (
              <span className="text-xs text-gray-500">{formatDate(match.match_date)}</span>
            )}
            {match.group_name && (
              <span className="text-xs bg-white/5 text-gray-400 px-1.5 py-0.5 rounded-md">
                Grp. {match.group_name}
              </span>
            )}
            {match.stage !== 'group' && (
              <span className="text-xs bg-white/5 text-gray-400 px-1.5 py-0.5 rounded-md">
                {STAGE_LABELS[match.stage] || match.stage}
              </span>
            )}
            <span className="text-gray-600 text-sm">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Consensus bar (always visible in collapsed state) */}
        {hasTips && !expanded && (
          <div className="mt-3">
            <ConsensusBar tips={match.tips} consensus={match.consensus} />
          </div>
        )}
      </button>

      {/* Expanded: all model tips */}
      {expanded && hasTips && (
        <div className="border-t border-white/5 p-4 space-y-5 animate-slide-up">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">AI Predictions</span>
            <ConsensusBar tips={match.tips} consensus={match.consensus} />
          </div>
          {match.tips.map(tip => (
            <ReasoningPanel key={tip.model_id} tip={tip} />
          ))}

          {/* Result if finished */}
          {isFinished && (
            <div className="border-t border-white/5 pt-4">
              <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Result</div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-extrabold">{match.home_score}:{match.away_score}</span>
                <span className="text-gray-500">– {match.home_team} vs {match.away_team}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {expanded && !hasTips && (
        <div className="border-t border-white/5 p-4 text-sm text-gray-500 italic animate-slide-up">
          No predictions available for this match yet.
        </div>
      )}
    </div>
  );
}
