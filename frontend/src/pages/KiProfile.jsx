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
        <div key={i} className="card h-64 animate-pulse" />
      ))}
    </div>
  );

  if (error) return (
    <div className="pt-8 text-center text-red-500">
      <p>Error loading profiles: {error}</p>
    </div>
  );

  if (!models || !models.length) return (
    <div className="pt-8 text-center text-gray-400">
      <p>No models found.</p>
    </div>
  );

  const sorted = [...models].sort((a, b) => b.total_points - a.total_points);
  const withRank = sorted.map((m, i) => ({ ...m, rank: i + 1 }));

  return (
    <div className="pt-4 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">AI Profiles</h1>
        <p className="text-sm text-gray-500 mt-1">Five models, 104 matches. Who predicts best?</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {withRank.map(model => (
          <ModelCard key={model.id} model={model} />
        ))}
      </div>

      <div className="mt-8 card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">How scoring works</h2>
        <div className="space-y-4 text-sm text-gray-500">
          <div>
            <p className="font-medium text-gray-800">Kicktipp scoring</p>
            <p className="mt-0.5">Exact result = 4 pts · Correct goal difference = 3 pts · Correct tendency = 2 pts</p>
          </div>
          <div>
            <p className="font-medium text-gray-800">Prediction schedule</p>
            <p className="mt-0.5">T-1 day at 09:00, then again 45 minutes before kick-off with the latest lineups.</p>
          </div>
          <div>
            <p className="font-medium text-gray-800">OddsBot</p>
            <p className="mt-0.5">Uses a Dixon-Coles Poisson model with live betting odds — no LLM involved.</p>
          </div>
          <div>
            <p className="font-medium text-gray-800">Knockout rounds</p>
            <p className="mt-0.5">As soon as a team qualifies, all models automatically predict their next match.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
