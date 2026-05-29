import React, { useEffect, useState, useCallback } from 'react';
import MatchCard from '../components/MatchCard.jsx';
import LiveTicker from '../components/LiveTicker.jsx';

function useFetch(url, interval = 60000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [url]);

  useEffect(() => {
    load();
    const timer = setInterval(load, interval);
    return () => clearInterval(timer);
  }, [load, interval]);

  return { data, loading, error, refresh: load };
}

function SectionHeader({ title, count, badge }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-base font-bold text-white">{title}</h2>
      {count !== undefined && (
        <span className="text-xs bg-white/10 text-gray-400 px-2 py-0.5 rounded-full">{count}</span>
      )}
      {badge}
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="card p-6 text-center text-gray-500 text-sm">{label}</div>
  );
}

export default function Spiele() {
  const { data, loading, error, refresh } = useFetch('/api/matches', 30000);

  // Auto-refresh faster when there are live matches
  useEffect(() => {
    if (!data?.live?.length) return;
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, [data?.live?.length, refresh]);

  if (loading) return (
    <div className="pt-4 space-y-3">
      {[...Array(5)].map((_, i) => <div key={i} className="card h-20 animate-pulse bg-white/3" />)}
    </div>
  );

  if (error) return (
    <div className="pt-8 text-center text-red-400">
      <div className="text-4xl mb-3">⚠️</div>
      <p>Fehler beim Laden: {error}</p>
    </div>
  );

  const { live = [], today = [], upcoming = [], recent = [] } = data || {};
  const hasLive = live.length > 0;

  return (
    <div className="pt-4 space-y-8 animate-fade-in">
      {/* LIVE */}
      {hasLive && (
        <section>
          <SectionHeader
            title="Live"
            count={live.length}
            badge={<span className="badge-live"><span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />Jetzt</span>}
          />
          <LiveTicker matches={live} />
        </section>
      )}

      {/* HEUTE */}
      <section>
        <SectionHeader
          title="Heute"
          count={today.length}
          badge={<span className="text-xs text-gray-500">{new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}</span>}
        />
        {today.length ? (
          <div className="space-y-3">
            {today.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        ) : (
          <EmptyState label="Heute keine Spiele geplant" />
        )}
      </section>

      {/* NÄCHSTE SPIELE */}
      <section>
        <SectionHeader title="Nächste Spiele" count={upcoming.length} />
        {upcoming.length ? (
          <div className="space-y-3">
            {upcoming.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        ) : (
          <EmptyState label="Keine weiteren Spiele in den nächsten 3 Tagen" />
        )}
      </section>

      {/* KÜRZLICHE ERGEBNISSE */}
      {recent.length > 0 && (
        <section>
          <SectionHeader title="Kürzliche Ergebnisse" count={recent.length} />
          <div className="space-y-3">
            {recent.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        </section>
      )}

      {!hasLive && !today.length && !upcoming.length && !recent.length && (
        <div className="pt-12 text-center text-gray-500">
          <div className="text-5xl mb-4">⚽</div>
          <p className="text-lg font-medium text-white mb-1">Das Turnier beginnt bald</p>
          <p className="text-sm">Alle 104 WM-Spiele werden hier gezeigt sobald die KI-Tipps vorliegen.</p>
        </div>
      )}
    </div>
  );
}
