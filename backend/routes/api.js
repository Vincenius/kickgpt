'use strict';
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { getTotals, getByStage } = require('../scoring');

function withDb(fn) {
  return (req, res) => {
    try { fn(req, res, getDb()); }
    catch (err) { res.status(500).json({ error: err.message }); }
  };
}

// Full match list with tips
function enrichMatches(db, matches) {
  const allTips = db.prepare(`
    SELECT t.*, m.name as model_name, m.display_name, m.color, m.bg_color, m.tagline,
           s.points, s.score_type
    FROM tips t
    JOIN models m ON m.id = t.model_id
    LEFT JOIN scores s ON s.model_id = t.model_id AND s.match_id = t.match_id
    WHERE t.match_id IN (${matches.map(() => '?').join(',')})
  `).all(...matches.map(m => m.id));

  const tipsByMatch = {};
  for (const t of allTips) {
    if (!tipsByMatch[t.match_id]) tipsByMatch[t.match_id] = [];
    tipsByMatch[t.match_id].push(t);
  }

  return matches.map(match => {
    const tips = tipsByMatch[match.id] || [];
    const consensus = computeConsensus(tips);
    return { ...match, tips, consensus };
  });
}

function computeConsensus(tips) {
  if (!tips.length) return null;
  const avgHome = tips.reduce((s, t) => s + t.home, 0) / tips.length;
  const avgAway = tips.reduce((s, t) => s + t.away, 0) / tips.length;
  const homeVotes = tips.filter(t => t.home > t.away).length;
  const drawVotes = tips.filter(t => t.home === t.away).length;
  const awayVotes = tips.filter(t => t.home < t.away).length;

  const maxDiff = tips.reduce((max, t1) =>
    tips.reduce((mx, t2) => Math.max(mx, Math.abs((t1.home - t1.away) - (t2.home - t2.away))), max)
  , 0);

  const uniqueScores = new Set(tips.map(t => `${t.home}:${t.away}`)).size;

  return {
    avg_home: Math.round(avgHome * 10) / 10,
    avg_away: Math.round(avgAway * 10) / 10,
    home_votes: homeVotes,
    draw_votes: drawVotes,
    away_votes: awayVotes,
    is_disputed: uniqueScores > 2 || maxDiff > 2,
    max_diff: maxDiff,
    unique_scores: uniqueScores,
  };
}

function getSurpriseTip(db) {
  const today = new Date().toISOString().slice(0, 10);
  const todayMatches = db.prepare(`SELECT id FROM matches WHERE match_date = ?`).all(today).map(m => m.id);
  if (!todayMatches.length) return null;

  const tips = db.prepare(`
    SELECT t.*, m.display_name, m.color, ma.home_team, ma.away_team
    FROM tips t
    JOIN models m ON m.id = t.model_id
    JOIN matches ma ON ma.id = t.match_id
    WHERE t.match_id IN (${todayMatches.map(() => '?').join(',')})
  `).all(...todayMatches);

  // Find the tip most different from consensus
  const byMatch = {};
  for (const t of tips) {
    if (!byMatch[t.match_id]) byMatch[t.match_id] = [];
    byMatch[t.match_id].push(t);
  }

  let maxDeviation = 0, surprise = null;
  for (const [, matchTips] of Object.entries(byMatch)) {
    if (matchTips.length < 2) continue;
    const avgDiff = matchTips.reduce((s, t) => s + (t.home - t.away), 0) / matchTips.length;
    for (const tip of matchTips) {
      const dev = Math.abs((tip.home - tip.away) - avgDiff);
      if (dev > maxDeviation) {
        maxDeviation = dev;
        surprise = tip;
      }
    }
  }

  return surprise ? {
    model_name: surprise.display_name,
    model_color: surprise.color,
    match: `${surprise.home_team} vs ${surprise.away_team}`,
    tip: `${surprise.home}:${surprise.away}`,
    deviation: Math.round(maxDeviation * 10) / 10,
    summary: surprise.summary,
  } : null;
}

function getTimeline(db) {
  return db.prepare(`
    SELECT s.model_id, m.display_name, m.color,
           date(ma.match_date) as match_date,
           SUM(s.points) OVER (PARTITION BY s.model_id ORDER BY ma.match_date) as cumulative_points
    FROM scores s
    JOIN matches ma ON ma.id = s.match_id
    JOIN models m ON m.id = s.model_id
    ORDER BY ma.match_date, s.model_id
  `).all();
}

// GET /api/leaderboard
router.get('/leaderboard', withDb((req, res, db) => {
  const models = getTotals(db);
  const byStage = getByStage(db);
  const surprise = getSurpriseTip(db);
  const timeline = getTimeline(db);

  const leader = models[0] || null;
  const gap = models.length >= 2 ? (models[0]?.total_points || 0) - (models[1]?.total_points || 0) : 0;

  // Compute trends (compare last 5 matches)
  const recentScores = db.prepare(`
    SELECT s.model_id, SUM(s.points) as recent_pts
    FROM scores s
    JOIN matches ma ON ma.id = s.match_id
    WHERE ma.match_date >= date('now', '-3 days')
    GROUP BY s.model_id
  `).all();
  const recentMap = Object.fromEntries(recentScores.map(r => [r.model_id, r.recent_pts]));

  const rankedModels = models.map((m, i) => ({
    ...m,
    rank: i + 1,
    trend: (recentMap[m.id] || 0) > 4 ? 1 : (recentMap[m.id] || 0) > 0 ? 0 : -1,
    recent_pts: recentMap[m.id] || 0,
  }));

  res.json({ leader, gap, models: rankedModels, by_stage: byStage, surprise_tip: surprise, timeline });
}));

// GET /api/matches
router.get('/matches', withDb((req, res, db) => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const live = db.prepare(`SELECT * FROM matches WHERE status IN ('IN_PLAY', 'PAUSED') ORDER BY match_date`).all();
  const todayMatches = db.prepare(`SELECT * FROM matches WHERE match_date = ? AND status NOT IN ('IN_PLAY', 'PAUSED', 'FINISHED') ORDER BY match_date`).all(today);
  const upcoming = db.prepare(`SELECT * FROM matches WHERE match_date > ? AND match_date <= ? AND status = 'SCHEDULED' ORDER BY match_date LIMIT 20`).all(today, threeDays);
  const recent = db.prepare(`SELECT * FROM matches WHERE status = 'FINISHED' ORDER BY match_date DESC LIMIT 10`).all();

  const allMatches = [...new Map([...live, ...todayMatches, ...upcoming, ...recent].map(m => [m.id, m])).values()];
  const enriched = enrichMatches(db, allMatches);
  const enrichedMap = Object.fromEntries(enriched.map(m => [m.id, m]));

  res.json({
    live: live.map(m => enrichedMap[m.id]),
    today: todayMatches.map(m => enrichedMap[m.id]),
    upcoming: upcoming.map(m => enrichedMap[m.id]),
    recent: recent.map(m => enrichedMap[m.id]),
  });
}));

// GET /api/match/:id
router.get('/match/:id', withDb((req, res, db) => {
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const [enriched] = enrichMatches(db, [match]);
  const history = db.prepare(`
    SELECT th.*, m.display_name, m.color FROM tip_history th
    JOIN models m ON m.id = th.model_id
    WHERE th.match_id = ?
    ORDER BY th.created_at DESC
  `).all(match.id);

  res.json({ ...enriched, history });
}));

// GET /api/models
router.get('/models', withDb((req, res, db) => {
  const totals = getTotals(db);

  const enriched = totals.map(m => {
    const tipsCount = db.prepare('SELECT COUNT(*) as c FROM tips WHERE model_id = ?').get(m.id).c;
    const avgConf = db.prepare('SELECT AVG(confidence) as a FROM tips WHERE model_id = ?').get(m.id).a;

    const bestTip = db.prepare(`
      SELECT t.home, t.away, t.summary, ma.home_team, ma.away_team, s.points
      FROM tips t JOIN matches ma ON ma.id = t.match_id JOIN scores s ON s.model_id = t.model_id AND s.match_id = t.match_id
      WHERE t.model_id = ? ORDER BY s.points DESC LIMIT 1
    `).get(m.id);

    const worstTip = db.prepare(`
      SELECT t.home, t.away, t.summary, ma.home_team, ma.away_team, s.points
      FROM tips t JOIN matches ma ON ma.id = t.match_id JOIN scores s ON s.model_id = t.model_id AND s.match_id = t.match_id
      WHERE t.model_id = ? ORDER BY s.points ASC LIMIT 1
    `).get(m.id);

    return {
      ...m,
      tips_count: tipsCount,
      avg_confidence: avgConf ? Math.round(avgConf) : null,
      best_tip: bestTip,
      worst_tip: worstTip,
    };
  });

  res.json(enriched);
}));

// GET /api/model/:id
router.get('/model/:id', withDb((req, res, db) => {
  const model = db.prepare('SELECT * FROM models WHERE id = ?').get(req.params.id);
  if (!model) return res.status(404).json({ error: 'Model not found' });

  const tips = db.prepare(`
    SELECT t.*, ma.home_team, ma.away_team, ma.match_date, ma.stage, ma.group_name,
           ma.home_score, ma.away_score, s.points, s.score_type
    FROM tips t
    JOIN matches ma ON ma.id = t.match_id
    LEFT JOIN scores s ON s.model_id = t.model_id AND s.match_id = t.match_id
    WHERE t.model_id = ?
    ORDER BY ma.match_date
  `).all(model.id);

  res.json({ ...model, tips });
}));

// GET /api/matches/predicted – all matches that have at least one tip, regardless of date
router.get('/matches/predicted', withDb((req, res, db) => {
  const matches = db.prepare(`
    SELECT DISTINCT ma.* FROM matches ma
    JOIN tips t ON t.match_id = ma.id
    ORDER BY ma.match_date, ma.id
  `).all();

  if (!matches.length) return res.json([]);
  res.json(enrichMatches(db, matches));
}));

// GET /api/bonus-tips
router.get('/bonus-tips', withDb((req, res, db) => {
  const tips = db.prepare(`
    SELECT bt.*, m.display_name, m.color, m.name as model_name FROM bonus_tips bt
    JOIN models m ON m.id = bt.model_id
    ORDER BY bt.question, m.display_name
  `).all();

  const results = db.prepare('SELECT * FROM bonus_results').all();

  const today = new Date().toISOString().split('T')[0];
  const tournamentStarted = today >= '2026-06-11' ||
    db.prepare("SELECT COUNT(*) as c FROM matches WHERE status != 'SCHEDULED'").get().c > 0;

  res.json({ tips, results, locked: tournamentStarted });
}));

module.exports = router;
