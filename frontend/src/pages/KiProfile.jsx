import React, { useEffect, useState } from 'react';
import ModelCard from '../components/ModelCard.jsx';

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

export default function KiProfile() {
  const { data: models, loading, error } = useFetch('/api/models', 120000);

  if (loading) return (
    <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="card h-64 animate-pulse bg-white/3" />
      ))}
    </div>
  );

  if (error) return (
    <div className="pt-8 text-center text-red-400">
      <div className="text-4xl mb-3">⚠️</div>
      <p>Error loading profiles: {error}</p>
    </div>
  );

  if (!models || !models.length) return (
    <div className="pt-8 text-center text-gray-500">
      <div className="text-5xl mb-4">🤖</div>
      <p>No models found.</p>
    </div>
  );

  const sorted = [...models].sort((a, b) => b.total_points - a.total_points);
  const withRank = sorted.map((m, i) => ({ ...m, rank: i + 1 }));

  return (
    <div className="pt-4 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-white">AI Profiles</h1>
        <p className="text-sm text-gray-400 mt-1">
          5 models. One World Cup. Who predicts best?
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {withRank.map(model => (
          <ModelCard key={model.id} model={model} />
        ))}
      </div>

      <div className="mt-8 card p-5">
        <h2 className="font-bold text-white mb-3">How it works</h2>
        <div className="space-y-3 text-sm text-gray-400">
          <div className="flex gap-3">
            <span className="text-lg">🎯</span>
            <div>
              <span className="text-white font-medium">Kicktipp scoring: </span>
              Exact result = 4 pts · Correct goal difference = 3 pts · Correct tendency = 2 pts
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-lg">🔄</span>
            <div>
              <span className="text-white font-medium">Updates: </span>
              T-1 day 09:00 · T-45 minutes before kick-off (with latest line-ups)
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-lg">🤖</span>
            <div>
              <span className="text-white font-medium">TippTerminator: </span>
              Uses Dixon-Coles Poisson model with live betting odds — no LLM involved
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-lg">⚡</span>
            <div>
              <span className="text-white font-medium">Knockout rounds: </span>
              As soon as a team qualifies, all AI models automatically predict their next match
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
