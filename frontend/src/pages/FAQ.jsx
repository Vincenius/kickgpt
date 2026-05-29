import React, { useState } from 'react';

const FAQS = [
  {
    category: 'Scoring',
    items: [
      {
        q: 'How does the scoring system work?',
        a: (
          <div className="space-y-2">
            <p>The competition uses standard Kicktipp scoring:</p>
            <ul className="space-y-1 mt-2">
              <li className="flex items-baseline gap-3">
                <span className="font-bold text-gray-900 tabular-nums w-8 text-right shrink-0">4 pts</span>
                <span>Exact score (e.g. you tip 2:1 and the result is 2:1)</span>
              </li>
              <li className="flex items-baseline gap-3">
                <span className="font-bold text-gray-900 tabular-nums w-8 text-right shrink-0">3 pts</span>
                <span>Correct goal difference (e.g. tip 2:0, result 3:1 — both are +2)</span>
              </li>
              <li className="flex items-baseline gap-3">
                <span className="font-bold text-gray-900 tabular-nums w-8 text-right shrink-0">2 pts</span>
                <span>Correct tendency (win/draw/loss, but wrong margin)</span>
              </li>
              <li className="flex items-baseline gap-3">
                <span className="font-bold text-gray-900 tabular-nums w-8 text-right shrink-0">0 pts</span>
                <span>Wrong tendency</span>
              </li>
            </ul>
            <p className="mt-2 text-gray-400 text-xs">The models are explicitly told to go for maximum points — not just to pick the most likely winner. That sometimes means tipping a boring 1:0 instead of a flashy 3:1.</p>
          </div>
        ),
      },
      {
        q: 'What do the colored indicators on match cards mean?',
        a: (
          <div className="space-y-2">
            <p>Each model&apos;s tip is displayed alongside the actual result once the match is played. The point badges show:</p>
            <ul className="mt-2 space-y-1">
              <li><span className="font-semibold text-emerald-700">Green (4 pts)</span> — exact score hit</li>
              <li><span className="font-semibold text-blue-700">Blue (3 pts)</span> — correct goal difference</li>
              <li><span className="font-semibold text-gray-700">Gray (2 pts)</span> — correct tendency</li>
              <li><span className="font-semibold text-red-500">Red (0 pts)</span> — wrong tendency</li>
            </ul>
            <p className="mt-2">The consensus bar at the top of a match shows how many models agree on the same winner. Green means strong agreement; amber means the models are split.</p>
          </div>
        ),
      },
    ],
  },
  {
    category: 'The Models',
    items: [
      {
        q: 'Which models are competing?',
        a: (
          <div className="space-y-2">
            <p>Five models compete across all 104 World Cup matches:</p>
            <ul className="mt-2 space-y-1.5">
              <li><span className="font-semibold">Claude</span> (Anthropic) — claude-sonnet-4-6 with built-in web search</li>
              <li><span className="font-semibold">GPT-4o mini</span> (OpenAI) — with web browsing / search tools</li>
              <li><span className="font-semibold">Gemini</span> (Google) — with Google Search grounding</li>
              <li><span className="font-semibold">Grok</span> (xAI) — with real-time X/Twitter data access</li>
              <li><span className="font-semibold">Mistral</span> (Mistral AI) — with web search tools</li>
              <li><span className="font-semibold">OddsBot</span> — a pure math model, no LLM (see below)</li>
            </ul>
          </div>
        ),
      },
      {
        q: 'What is OddsBot and why is it different?',
        a: (
          <div className="space-y-2">
            <p>OddsBot is the only competitor that is not an AI language model. Instead of reasoning about football, it reads live betting odds and does math.</p>
            <p>In short: it strips the bookmaker&apos;s margin from the odds, converts the implied probabilities into expected goal numbers, and picks whichever score would earn the most Kicktipp points on average.</p>
            <p>It has no opinions, no favorites, and no idea who Messi is. It just bets on what the market already knows.</p>
          </div>
        ),
      },
      {
        q: 'How do the AI models decide on a score?',
        a: (
          <div className="space-y-2">
            <p>Each model searches the web before it tips, looking at things like:</p>
            <ul className="mt-1 space-y-0.5 list-disc list-inside">
              <li>Recent form and results</li>
              <li>Injuries and suspensions</li>
              <li>Expected lineups (especially in the 45-minute update)</li>
              <li>Head-to-head history</li>
              <li>Bookmaker odds</li>
              <li>What&apos;s at stake in the group</li>
            </ul>
            <p className="mt-2">They are told to go for the highest <em>expected points</em>, not just the most likely outcome. So a model might tip 1:0 even if a 2:1 win is slightly more probable — because a correct 1:0 is worth more than an almost-right 2:1.</p>
          </div>
        ),
      },
      {
        q: 'Do all models get the same prompt?',
        a: (
          <div className="space-y-2">
            <p>Yes — every model receives the exact same prompt. No model is given extra context, a friendlier framing, or a different scoring explanation. The only thing that differs is which API is called and which search tools each provider makes available.</p>
            <p className="mt-2">Here is the actual prompt template (with a hypothetical match filled in):</p>
            <pre className="mt-2 bg-gray-50 border border-gray-200 rounded-md p-3 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-mono">{`You are competing in an AI prediction tournament for FIFA WM 2026.
Research all information needed and predict the score for:
Germany vs Brazil | 2026-07-15 | Stage: Final
Trigger: t-45min (initial|t-1day|t-45min|ko-advance)

KO rules: tip result after full penalty shootout if needed. Draws valid (goes to extra time). Group stage = 90min only.
Scoring: 4pts exact, 3pts goal difference, 2pts tendency. Optimize for maximum expected prediction points.

Research: current form, injuries, suspensions, head-to-head, tournament context, bookmaker odds. Mention sources used.

Return ONLY valid JSON:
{
  "home": <int, goals for Germany>,
  "away": <int, goals for Brazil>,
  "confidence": <0-100>,
  "summary": "<2-3 sentences: key reason, written for a curious non-expert audience>",
  "reasoning": "<full research trace: sources, odds found, injuries, form, why this scoreline maximizes expected points>"
}
IMPORTANT: "home" = Germany goals, "away" = Brazil goals. Your summary and reasoning MUST reflect the team your score predicts to win (or a draw). Do not write that one team is favored if your score shows the other team winning.`}</pre>
          </div>
        ),
      },
    ],
  },
  {
    category: 'Predictions',
    items: [
      {
        q: 'When do the models make their predictions?',
        a: (
          <div className="space-y-2">
            <p>Every match gets two predictions:</p>
            <ol className="mt-1 space-y-1 list-decimal list-inside">
              <li><span className="font-semibold">Initial tip</span> — made well before the match, based on current form, head-to-head history, and odds</li>
              <li><span className="font-semibold">45 minutes before kick-off</span> — a final update once confirmed lineups are available</li>
            </ol>
            <p className="mt-2">The score shown on the site is always the latest tip. If a key player is ruled out right before the game, the 45-minute update can shift the prediction noticeably.</p>
          </div>
        ),
      },
      {
        q: 'What about knockout round matches?',
        a: (
          <p>
            Knockout opponents are only confirmed once group stage results are in. The moment both teams are officially known, the models automatically generate their initial predictions — no manual trigger needed. The 45-minute pre-kickoff update then applies as usual.
          </p>
        ),
      },
      {
        q: 'Can predictions be updated after the match starts?',
        a: (
          <p>
            No. Once kick-off happens, all tips are locked. The bonus predictions (champion, top scorer, group winners) are locked even earlier — as soon as the tournament begins.
          </p>
        ),
      },
      {
        q: 'How are extra time and penalties handled?',
        a: (
          <p>
            In knockout rounds, the models predict the final result — including extra time and penalties if it comes to that. A tip of 1:1 is not wrong just because the game goes to extra time; it means the model expected it to be level after 90 minutes and someone else to go through on penalties.
          </p>
        ),
      },
    ],
  },
  {
    category: 'About',
    items: [
      {
        q: 'Who built this?',
        a: (
          <p>
            KickGPT was built by{' '}
            <a href="https://vincentwill.com" target="_blank" rel="noopener noreferrer" className="text-gray-900 font-medium underline underline-offset-2 hover:no-underline">
              Vincent Will
            </a>{' '}
            as a fun side project for the 2026 FIFA World Cup. The backend runs on Node.js + Express with a SQLite database; the frontend is React + Vite + Tailwind CSS.
          </p>
        ),
      },
      {
        q: 'Is the data live?',
        a: (
          <p>
            Yes. Scores are pulled from a live football data API and updated in real time during matches. The standings page refreshes every 30 seconds. Predictions are generated automatically as matches approach — no one is sitting here pressing buttons.
          </p>
        ),
      },
    ],
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        className="w-full flex items-center justify-between gap-4 py-4 text-left text-sm font-medium text-gray-900 hover:text-gray-700 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span>{q}</span>
        <span className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="pb-4 text-sm text-gray-500 leading-relaxed">
          {a}
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  return (
    <div className="pt-4 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">FAQ</h1>
        <p className="text-sm text-gray-500 mt-1">How the competition works, how the models think, and everything in between.</p>
      </div>

      <div className="space-y-6">
        {FAQS.map(({ category, items }) => (
          <div key={category} className="card">
            <div className="px-5 pt-4 pb-1">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{category}</h2>
            </div>
            <div className="px-5">
              {items.map(({ q, a }) => (
                <FaqItem key={q} q={q} a={a} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
