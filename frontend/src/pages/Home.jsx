import React, { useEffect, useState, useCallback } from 'react';
import MatchCard from '../components/MatchCard.jsx';
import LiveTicker from '../components/LiveTicker.jsx';

const TOURNAMENT_START = new Date('2026-06-11');

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

function daysUntilTournament() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((TOURNAMENT_START - today) / (1000 * 60 * 60 * 24));
}

function Sparkline({ points, color, width = 72, height = 24 }) {
  if (!points || points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const xs = points.map((_, i) => (i / (points.length - 1)) * width);
  const ys = points.map(v => height - ((v - min) / range) * (height - 4) - 2);
  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ys[i]}`).join(' ');
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2" fill={color} />
    </svg>
  );
}

function TrendArrow({ trend }) {
  if (trend > 0) return <span className="text-emerald-500 text-sm font-bold">+</span>;
  if (trend < 0) return <span className="text-red-400 text-sm font-bold">−</span>;
  return <span className="text-gray-300 text-sm">—</span>;
}

function Standings({ models, timeline }) {
  if (!models || !models.length) return null;

  const byModel = {};
  if (timeline) {
    for (const entry of timeline) {
      if (!byModel[entry.model_id]) byModel[entry.model_id] = [];
      byModel[entry.model_id].push(entry.cumulative_points);
    }
  }

  return (
    <div className="card overflow-hidden">
      {models.map((m, i) => (
        <div
          key={m.id}
          className={`flex items-center gap-3 px-5 py-3.5 ${i < models.length - 1 ? 'border-b border-gray-100' : ''} ${i === 0 ? 'bg-gray-50/70' : ''}`}
        >
          <span className="text-gray-300 font-mono text-sm w-5 text-center shrink-0">{i + 1}</span>
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
          <span className="font-medium text-gray-900 flex-1 text-sm">{m.display_name}</span>
          {byModel[m.id] && (
            <Sparkline points={byModel[m.id]} color={m.color} />
          )}
          <TrendArrow trend={m.trend} />
          <span className="font-bold tabular-nums text-gray-900 text-sm text-right shrink-0 w-16">
            {m.total_points} <span className="text-gray-400 font-normal text-xs">pts</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ title, count, badge }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</h2>
      {count !== undefined && (
        <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">{count}</span>
      )}
      {badge}
    </div>
  );
}

function PreTournamentBanner({ days }) {
  return (
    <div className="card p-5 border-l-4 border-l-indigo-400">
      <h1 className="font-bold text-gray-900 text-lg leading-tight">
        5 AI models. 104 matches. Who predicts best?
      </h1>
      <p className="text-sm text-gray-500 mt-2 leading-relaxed">
        Claude, GPT-4o mini, Gemini, Grok, and Mistral each predict every FIFA World Cup 2026 match — scored live against the real results. Every prediction is already locked in before kick-off.
      </p>
      {days > 0 && (
        <div className="mt-3 inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-indigo-100">
          {days} day{days !== 1 ? 's' : ''} until kick-off · Jun 11, 2026
        </div>
      )}
    </div>
  );
}

function BonusTipsPreview({ data }) {
  if (!data?.tips?.length) return null;

  const SHOW_QUESTIONS = ['World Champion 2026', 'Top Scorer 2026'];
  const byQuestion = {};
  for (const t of data.tips) {
    if (!byQuestion[t.question]) byQuestion[t.question] = [];
    byQuestion[t.question].push(t);
  }

  const cards = SHOW_QUESTIONS.filter(q => byQuestion[q]);
  if (!cards.length) return null;

  return (
    <section>
      <SectionHeader title="Tournament Picks" badge={
        <span className="text-xs text-gray-400">What each AI picked before a ball was kicked</span>
      } />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map(question => {
          const tips = byQuestion[question];
          const activeTips = tips.map(t => {
            let candidates = [];
            try { candidates = JSON.parse(t.candidates || '[]'); } catch {}
            return { ...t, candidates };
          }).filter(t => t.candidates[0]?.name && !t.candidates[0].name.startsWith('N/A'));

          const pickCounts = {};
          activeTips.forEach(t => {
            const pick = t.candidates[0].name;
            pickCounts[pick] = (pickCounts[pick] || 0) + 1;
          });
          const topConsensus = Object.entries(pickCounts).sort((a, b) => b[1] - a[1])[0];

          return (
            <div key={question} className="card p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className="font-semibold text-gray-900 text-sm leading-tight">{question}</span>
                {topConsensus && (
                  <span className="badge-consensus whitespace-nowrap flex-shrink-0 text-xs">
                    {topConsensus[0]} · {topConsensus[1]}/{activeTips.length}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {activeTips.map(t => (
                  <div key={t.display_name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                      <span className="text-gray-400">{t.display_name}</span>
                    </div>
                    <span className="font-medium text-gray-900">{t.candidates[0].name}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function groupByLabel(matches) {
  const STAGE_LABELS = {
    r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarter-final',
    sf: 'Semi-final', final: 'Final', '3rd': '3rd Place',
  };
  const groups = {};
  for (const m of matches) {
    const key = m.group_name ? `Group ${m.group_name}` : (STAGE_LABELS[m.stage] || m.stage);
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  }
  return groups;
}

export default function Home() {
  const { data: leaderboard, loading: lbLoading } = useFetch('/api/leaderboard', 30000);
  const { data: matches, loading: mLoading, refresh } = useFetch('/api/matches', 30000);
  const { data: predictedMatches } = useFetch('/api/matches/predicted', 120000);
  const { data: bonusData } = useFetch('/api/bonus-tips', 120000);

  useEffect(() => {
    if (!matches?.live?.length) return;
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, [matches?.live?.length, refresh]);

  const { models, timeline } = leaderboard || {};
  const { live = [], today = [], upcoming = [], recent = [] } = matches || {};
  const hasLive = live.length > 0;
  const loading = lbLoading && mLoading;
  const isPreTournament = !hasLive && !today.length && !recent.length;
  const days = daysUntilTournament();

  if (loading) return (
    <div className="pt-6 space-y-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="card h-14 animate-pulse" />
      ))}
    </div>
  );

  const hasPredictedMatches = predictedMatches && predictedMatches.length > 0;
  const grouped = hasPredictedMatches ? groupByLabel(predictedMatches) : {};

  return (
    <div className="pt-6 space-y-10 animate-fade-in">
      {isPreTournament && <PreTournamentBanner days={days} />}

      <section>
        <SectionHeader title="Standings" />
        <Standings models={models} timeline={timeline} />
      </section>

      {hasLive && (
        <section>
          <SectionHeader
            title="Live"
            count={live.length}
            badge={<span className="badge-live"><span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />Now</span>}
          />
          <LiveTicker matches={live} />
        </section>
      )}

      {today.length > 0 && (
        <section>
          <SectionHeader
            title="Today"
            count={today.length}
            badge={
              <span className="text-xs text-gray-400">
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long' })}
              </span>
            }
          />
          <div className="space-y-3">
            {today.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <SectionHeader title="Upcoming" count={upcoming.length} />
          <div className="space-y-3">
            {upcoming.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        </section>
      )}

      {isPreTournament && hasPredictedMatches && (
        <section>
          <SectionHeader
            title="First Predictions"
            badge={<span className="text-xs text-gray-400">Click any match to see what each AI picked</span>}
          />
          <div className="space-y-5">
            {Object.entries(grouped).map(([label, groupMatches]) => (
              <div key={label}>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</h3>
                <div className="space-y-2">
                  {groupMatches.map(m => <MatchCard key={m.id} match={m} />)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <SectionHeader title="Recent Results" count={recent.length} />
          <div className="space-y-3">
            {recent.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        </section>
      )}

      {isPreTournament && <BonusTipsPreview data={bonusData} />}
    </div>
  );
}
