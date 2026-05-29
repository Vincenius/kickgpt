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
      <p>Fehler beim Laden: {error}</p>
    </div>
  );

  if (!models || !models.length) return (
    <div className="pt-8 text-center text-gray-500">
      <div className="text-5xl mb-4">🤖</div>
      <p>Keine Modelle gefunden.</p>
    </div>
  );

  // Sort by rank (total_points desc, same as leaderboard)
  const sorted = [...models].sort((a, b) => b.total_points - a.total_points);
  const withRank = sorted.map((m, i) => ({ ...m, rank: i + 1 }));

  return (
    <div className="pt-4 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-white">KI-Profile</h1>
        <p className="text-sm text-gray-400 mt-1">
          5 Modelle. Eine Weltmeisterschaft. Wer tippt am besten?
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {withRank.map(model => (
          <ModelCard key={model.id} model={model} />
        ))}
      </div>

      {/* How it works */}
      <div className="mt-8 card p-5">
        <h2 className="font-bold text-white mb-3">So funktioniert es</h2>
        <div className="space-y-3 text-sm text-gray-400">
          <div className="flex gap-3">
            <span className="text-lg">🎯</span>
            <div>
              <span className="text-white font-medium">Kicktipp-Wertung: </span>
              Exaktes Ergebnis = 4 Punkte · Richtige Tordifferenz = 3 Punkte · Richtige Tendenz = 2 Punkte
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-lg">🔄</span>
            <div>
              <span className="text-white font-medium">Aktualisierung: </span>
              T-1 Tag 09:00 Uhr · T-45 Minuten vor Anpfiff (mit aktuellen Aufstellungen)
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-lg">🤖</span>
            <div>
              <span className="text-white font-medium">TippTerminator: </span>
              Nutzt Dixon-Coles Poisson-Modell mit echten Wettquoten – kein LLM
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-lg">⚡</span>
            <div>
              <span className="text-white font-medium">KO-Runden: </span>
              Sobald ein Team qualifiziert ist, tippt jedes KI-Modell automatisch das nächste Spiel
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
