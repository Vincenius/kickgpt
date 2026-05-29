'use strict';
require('dotenv').config();

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const MAX_GOALS = 8;

async function fetchOdds(homeTeam, awayTeam) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) throw new Error('ODDS_API_KEY not set');

  const url = new URL(`${ODDS_API_BASE}/sports/soccer_fifa_world_cup/odds`);
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('regions', 'eu');
  url.searchParams.set('markets', 'h2h,totals');
  url.searchParams.set('oddsFormat', 'decimal');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let response;
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    response = await res.json();
  } finally {
    clearTimeout(timer);
  }

  const normalize = s => s.toLowerCase().replace(/[^a-z]/g, '');
  const home = normalize(homeTeam);
  const away = normalize(awayTeam);

  const event = response.find(e =>
    normalize(e.home_team).includes(home.slice(0, 5)) ||
    normalize(e.away_team).includes(away.slice(0, 5))
  );

  return event || null;
}

function removeVig(odds) {
  const totalImplied = odds.reduce((sum, o) => sum + 1 / o, 0);
  return odds.map(o => (1 / o) / totalImplied);
}

// Estimate expected goals from h2h probabilities using simple optimization
function estimateLambdas(pH, pD, pA) {
  // Iteratively find lambda_h, lambda_a such that Poisson gives matching 1X2 probs
  let bestLh = 1.5, bestLa = 1.2, bestDist = Infinity;

  for (let lh = 0.3; lh <= 5; lh += 0.1) {
    for (let la = 0.3; la <= 5; la += 0.1) {
      const { pHwin, pDraw, pAwin } = poissonProbs(lh, la);
      const dist = (pHwin - pH) ** 2 + (pDraw - pD) ** 2 + (pAwin - pA) ** 2;
      if (dist < bestDist) { bestDist = dist; bestLh = lh; bestLa = la; }
    }
  }
  return { lambdaH: bestLh, lambdaA: bestLa };
}

function poissonPmf(k, lambda) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

function poissonProbs(lH, lA) {
  // Dixon-Coles low-score correction factor
  const tau = (x, y, lH, lA, rho) => {
    if (x === 0 && y === 0) return 1 - lH * lA * rho;
    if (x === 0 && y === 1) return 1 + lH * rho;
    if (x === 1 && y === 0) return 1 + lA * rho;
    if (x === 1 && y === 1) return 1 - rho;
    return 1;
  };

  const rho = -0.13; // typical Dixon-Coles correlation

  let pHwin = 0, pDraw = 0, pAwin = 0;
  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = poissonPmf(h, lH) * poissonPmf(a, lA) * tau(h, a, lH, lA, rho);
      if (h > a) pHwin += p;
      else if (h === a) pDraw += p;
      else pAwin += p;
    }
  }
  return { pHwin, pDraw, pAwin };
}

function buildScoreMatrix(lH, lA) {
  const rho = -0.13;
  const tau = (x, y) => {
    if (x === 0 && y === 0) return 1 - lH * lA * rho;
    if (x === 0 && y === 1) return 1 + lH * rho;
    if (x === 1 && y === 0) return 1 + lA * rho;
    if (x === 1 && y === 1) return 1 - rho;
    return 1;
  };

  const matrix = [];
  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = poissonPmf(h, lH) * poissonPmf(a, lA) * tau(h, a);
      matrix.push({ h, a, p });
    }
  }
  return matrix;
}

function expectedKicktippPoints(tipH, tipA, matrix, isKO) {
  let expected = 0;
  for (const { h, a, p } of matrix) {
    const td = tipH - tipA, rd = h - a;
    let pts = 0;
    if (tipH === h && tipA === a) pts = 4;
    else if (td === rd) pts = 3;
    else if (Math.sign(td) === Math.sign(rd)) pts = 2;

    // In KO, draw tips (tendency=draw) match any drawn result (regardless of score)
    if (isKO && Math.sign(td) === 0 && Math.sign(rd) === 0 && pts === 0) pts = 2;
    expected += p * pts;
  }
  return expected;
}

function selectBestTip(matrix, isKO) {
  let best = null;
  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const ev = expectedKicktippPoints(h, a, matrix, isKO);
      if (!best || ev > best.ev) best = { h, a, ev };
    }
  }
  return best;
}

async function predict(match, triggerType = 'initial') {
  const isKO = match.stage !== 'group';
  let lambdaH = 1.3, lambdaA = 1.1, usedOdds = false, oddsDetails = '';

  try {
    const event = await fetchOdds(match.home_team, match.away_team);
    if (event) {
      const bookmaker = event.bookmakers[0];
      const h2h = bookmaker?.markets.find(m => m.key === 'h2h');
      if (h2h && h2h.outcomes.length === 3) {
        const outcomes = h2h.outcomes;
        const homeOdds = outcomes.find(o => o.name === event.home_team)?.price;
        const awayOdds = outcomes.find(o => o.name === event.away_team)?.price;
        const drawOdds = outcomes.find(o => o.name === 'Draw')?.price;

        if (homeOdds && awayOdds && drawOdds) {
          const [pH, pD, pA] = removeVig([homeOdds, drawOdds, awayOdds]);
          ({ lambdaH, lambdaA } = estimateLambdas(pH, pD, pA));
          usedOdds = true;
          oddsDetails = `Odds ${event.home_team}: ${homeOdds} | Draw: ${drawOdds} | ${event.away_team}: ${awayOdds}. Implied probs (no-vig): Home ${(pH * 100).toFixed(1)}% | Draw ${(pD * 100).toFixed(1)}% | Away ${(pA * 100).toFixed(1)}%.`;
        }
      }
    }
  } catch (err) {
    console.warn(`[TippTerminator] Odds fetch failed: ${err.message}. Using defaults.`);
  }

  const matrix = buildScoreMatrix(lambdaH, lambdaA);
  const best = selectBestTip(matrix, isKO);

  const confidence = Math.round(Math.min(95, Math.max(10, best.ev / 4 * 100)));

  const summary = usedOdds
    ? `Laut ${oddsDetails} erwarte ich ${lambdaH.toFixed(1)} Tore für ${match.home_team} und ${lambdaA.toFixed(1)} für ${match.away_team}. ` +
      `Das Dixon-Coles-Modell maximiert mit ${best.h}:${best.a} den erwarteten Punkteertrag (${best.ev.toFixed(2)} Pkt im Durchschnitt).`
    : `Ohne aktuelle Wettquoten nutze ich Standardparameter (λH=${lambdaH}, λA=${lambdaA}). ` +
      `Das Poisson-Modell empfiehlt ${best.h}:${best.a} mit ${best.ev.toFixed(2)} erwarteten Kicktipp-Punkten.`;

  const reasoning = [
    `Model: Dixon-Coles Poisson (rho=-0.13), max goals=${MAX_GOALS}`,
    usedOdds ? oddsDetails : 'No odds available – using prior lambdas (H=1.3, A=1.1)',
    `Estimated lambdas: λH=${lambdaH.toFixed(3)}, λA=${lambdaA.toFixed(3)}`,
    `Optimal tip: ${best.h}:${best.a} → EV=${best.ev.toFixed(4)} Kicktipp points`,
    `KO mode: ${isKO}`,
  ].join('\n');

  return { home: best.h, away: best.a, confidence, summary, reasoning };
}

module.exports = { predict };
