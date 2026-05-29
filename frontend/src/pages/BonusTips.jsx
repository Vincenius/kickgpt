import React from 'react';

function useFetch(url, interval = 60000) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
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

const TOURNAMENT_QUESTIONS = ['World Champion 2026', 'Top Scorer 2026', "Top Scorer's Team 2026"];
const GROUP_QUESTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
  .map(g => `Group ${g} Winner`);

function QuestionCard({ question, tips, result }) {
  const modelTips = tips.map(t => {
    let candidates = [];
    try { candidates = JSON.parse(t.candidates || '[]'); } catch {}
    return { ...t, candidates };
  });

  const activeTips = modelTips.filter(t => t.candidates[0]?.name && !t.candidates[0].name.startsWith('N/A'));

  const pickCounts = {};
  activeTips.forEach(t => {
    const pick = t.candidates[0].name;
    pickCounts[pick] = (pickCounts[pick] || 0) + 1;
  });
  const topConsensus = Object.entries(pickCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight">{question}</h3>
        {result ? (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-blue-200 whitespace-nowrap flex-shrink-0">
            {result.correct_answer}
          </span>
        ) : topConsensus ? (
          <span className="badge-consensus whitespace-nowrap flex-shrink-0">
            {topConsensus[0]} &middot; {topConsensus[1]}/{activeTips.length}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        {modelTips.map(t => {
          const top = t.candidates[0];
          const isNA = !top || top.name?.startsWith('N/A');
          return (
            <div key={t.display_name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                <span className="text-gray-400 truncate">{t.display_name}</span>
              </div>
              {isNA ? (
                <span className="text-gray-300 italic">—</span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-gray-900 text-right">{top.name}</span>
                  <span className="text-gray-400 tabular-nums w-8 text-right">{top.probability}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Section({ title, questions, tipsByQuestion, resultsByQuestion }) {
  const cards = questions.filter(q => tipsByQuestion[q]);
  if (!cards.length) return null;

  return (
    <div className="mb-8">
      <h2 className="text-base font-bold text-gray-700 mb-3">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map(q => (
          <QuestionCard
            key={q}
            question={q}
            tips={tipsByQuestion[q]}
            result={resultsByQuestion[q]}
          />
        ))}
      </div>
    </div>
  );
}

export default function BonusTips() {
  const { data, loading, error } = useFetch('/api/bonus-tips', 120000);

  if (loading) return (
    <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="card h-40 animate-pulse" />
      ))}
    </div>
  );

  if (error) return (
    <div className="pt-8 text-center text-red-500">
      <p>Error loading predictions: {error}</p>
    </div>
  );

  const tips = data?.tips || [];
  const results = data?.results || [];
  const locked = data?.locked ?? false;

  if (!tips.length) return (
    <div className="pt-8 text-center text-gray-400">
      <p className="font-medium">No predictions yet.</p>
      <p className="text-sm mt-1">Run <code className="bg-gray-100 px-1 rounded">npm run tip:all</code> to generate them.</p>
    </div>
  );

  const tipsByQuestion = {};
  tips.forEach(t => {
    if (!tipsByQuestion[t.question]) tipsByQuestion[t.question] = [];
    tipsByQuestion[t.question].push(t);
  });

  const resultsByQuestion = {};
  results.forEach(r => { resultsByQuestion[r.question] = r; });

  return (
    <div className="pt-4 animate-fade-in">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tournament Predictions</h1>
          <p className="text-sm text-gray-500 mt-1">What each AI picked before a ball was kicked.</p>
        </div>
        {locked && (
          <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 whitespace-nowrap flex-shrink-0 mt-1">
            Locked
          </span>
        )}
      </div>

      <Section
        title="Tournament"
        questions={TOURNAMENT_QUESTIONS}
        tipsByQuestion={tipsByQuestion}
        resultsByQuestion={resultsByQuestion}
      />
      <Section
        title="Group Winners"
        questions={GROUP_QUESTIONS}
        tipsByQuestion={tipsByQuestion}
        resultsByQuestion={resultsByQuestion}
      />
    </div>
  );
}
