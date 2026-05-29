import React from 'react';

export default function ConsensusBar({ tips, consensus }) {
  if (!tips || tips.length === 0) return (
    <div className="text-xs text-gray-400">No tips yet</div>
  );

  const isDisputed = consensus?.is_disputed;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {isDisputed ? (
          <span className="badge-disputed">Disputed</span>
        ) : (
          <span className="badge-consensus">Consensus</span>
        )}

        {consensus && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {consensus.home_votes > 0 && (
              <span className="text-emerald-600 font-semibold">{consensus.home_votes}× Home</span>
            )}
            {consensus.draw_votes > 0 && (
              <span className="text-amber-600 font-semibold">{consensus.draw_votes}× Draw</span>
            )}
            {consensus.away_votes > 0 && (
              <span className="text-red-500 font-semibold">{consensus.away_votes}× Away</span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {tips.map((tip) => (
          <div key={tip.model_id} className="flex flex-col items-center gap-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: tip.color || '#9CA3AF' }}
              title={`${tip.display_name}: ${tip.home}:${tip.away}`}
            />
            <span className="text-[10px] font-mono text-gray-400 tabular-nums">
              {tip.home}:{tip.away}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
