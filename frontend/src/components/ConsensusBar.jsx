import React from 'react';

// Maps model api_type/name to color
const MODEL_COLORS = {
  claude: '#8B5CF6',
  gpt: '#10B981',
  gemini: '#3B82F6',
  grok: '#F97316',
  terminator: '#06B6D4',
};

export default function ConsensusBar({ tips, consensus }) {
  if (!tips || tips.length === 0) return (
    <div className="text-xs text-gray-500 italic">Kein Tipp vorhanden</div>
  );

  const isDisputed = consensus?.is_disputed;

  return (
    <div className="space-y-2">
      {/* Consensus / Disputed Badge */}
      <div className="flex items-center gap-2 flex-wrap">
        {isDisputed ? (
          <span className="badge-disputed">⚡ Streitfall</span>
        ) : (
          <span className="badge-consensus">✓ Konsens</span>
        )}

        {/* Vote counts */}
        {consensus && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {consensus.home_votes > 0 && (
              <span className="text-emerald-400 font-semibold">{consensus.home_votes}× Heimsieg</span>
            )}
            {consensus.draw_votes > 0 && (
              <span className="text-amber-400 font-semibold">{consensus.draw_votes}× Unentschieden</span>
            )}
            {consensus.away_votes > 0 && (
              <span className="text-red-400 font-semibold">{consensus.away_votes}× Auswärtssieg</span>
            )}
          </div>
        )}
      </div>

      {/* Score dots – one per model */}
      <div className="flex items-center gap-2">
        {tips.map((tip) => (
          <div key={tip.model_id} className="flex flex-col items-center gap-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: tip.color || MODEL_COLORS[tip.model_name] || '#6B7280' }}
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
