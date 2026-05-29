'use strict';
require('dotenv').config();
const { getDb } = require('./db');
const { calculatePoints } = require('./scoring');

const FD_BASE = 'https://api.football-data.org/v4';
const COMPETITION_ID = 2000; // FIFA World Cup

let pollerInterval = null;
let isPolling = false;

async function fdFetch(path, params, key) {
  const url = new URL(`${FD_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url.toString(), {
      headers: { 'X-Auth-Token': key },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLiveMatches() {
  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) return [];
  const data = await fdFetch(`/competitions/${COMPETITION_ID}/matches`, { status: 'IN_PLAY,PAUSED,FINISHED' }, key);
  return data.matches || [];
}

async function fetchTodayMatches() {
  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) return [];
  const today = new Date().toISOString().slice(0, 10);
  const data = await fdFetch(`/competitions/${COMPETITION_ID}/matches`, { dateFrom: today, dateTo: today }, key);
  return data.matches || [];
}

function mapStatus(fdStatus) {
  const map = {
    SCHEDULED: 'SCHEDULED',
    TIMED: 'SCHEDULED',
    IN_PLAY: 'IN_PLAY',
    PAUSED: 'PAUSED',
    FINISHED: 'FINISHED',
    SUSPENDED: 'SUSPENDED',
    CANCELLED: 'CANCELLED',
    POSTPONED: 'POSTPONED',
  };
  return map[fdStatus] || fdStatus;
}

function updateMatchInDb(db, fdMatch) {
  const externalId = String(fdMatch.id);
  const homeTeam = fdMatch.homeTeam?.shortName || fdMatch.homeTeam?.name || 'TBD';
  const awayTeam = fdMatch.awayTeam?.shortName || fdMatch.awayTeam?.name || 'TBD';
  const status = mapStatus(fdMatch.status);
  const homeScore = fdMatch.score?.fullTime?.home ?? null;
  const awayScore = fdMatch.score?.fullTime?.away ?? null;
  const minute = fdMatch.minute ?? null;

  const existing = db.prepare('SELECT id, home_score, away_score, status FROM matches WHERE external_id = ?').get(externalId);

  if (existing) {
    db.prepare(`
      UPDATE matches SET home_team = ?, away_team = ?, status = ?, home_score = ?, away_score = ?, minute = ?, updated_at = datetime('now')
      WHERE external_id = ?
    `).run(homeTeam, awayTeam, status, homeScore, awayScore, minute, externalId);
    return existing.status !== status || existing.home_score !== homeScore;
  } else {
    // Try to match by team names + date
    const matchDate = fdMatch.utcDate?.slice(0, 10);
    const slot = db.prepare(`
      SELECT id FROM matches WHERE match_date = ? AND (
        (home_team = ? AND away_team = ?) OR
        (home_team = 'TBD' AND stage = ?)
      ) LIMIT 1
    `).get(matchDate, homeTeam, awayTeam, mapFdStage(fdMatch.stage));

    if (slot) {
      db.prepare(`
        UPDATE matches SET external_id = ?, home_team = ?, away_team = ?, status = ?, home_score = ?, away_score = ?, minute = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(externalId, homeTeam, awayTeam, status, homeScore, awayScore, minute, slot.id);
      return true;
    }
    return false;
  }
}

function mapFdStage(stage) {
  const map = {
    GROUP_STAGE: 'group',
    ROUND_OF_32: 'r32',
    ROUND_OF_16: 'r16',
    QUARTER_FINALS: 'qf',
    SEMI_FINALS: 'sf',
    THIRD_PLACE: '3rd',
    FINAL: 'final',
  };
  return map[stage] || 'group';
}

function updateScoresForFinished(db) {
  const finishedWithTips = db.prepare(`
    SELECT m.id as match_id, m.home_score, m.away_score, t.model_id, t.home as tip_home, t.away as tip_away
    FROM matches m
    JOIN tips t ON t.match_id = m.id
    LEFT JOIN scores s ON s.match_id = m.id AND s.model_id = t.model_id
    WHERE m.status = 'FINISHED' AND m.home_score IS NOT NULL AND s.id IS NULL
  `).all();

  const upsertScore = db.prepare(`
    INSERT INTO scores (model_id, match_id, points, score_type)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(model_id, match_id) DO UPDATE SET points = ?, score_type = ?
  `);

  const tx = db.transaction(() => {
    for (const row of finishedWithTips) {
      const result = calculatePoints(row.tip_home, row.tip_away, row.home_score, row.away_score);
      if (result) {
        upsertScore.run(row.model_id, row.match_id, result.points, result.type, result.points, result.type);
      }
    }
  });
  tx();
  return finishedWithTips.length;
}

function getPollingInterval(db) {
  const liveCount = db.prepare(`SELECT COUNT(*) as c FROM matches WHERE status IN ('IN_PLAY', 'PAUSED')`).get().c;
  if (liveCount > 0) return 60 * 1000; // 60s when matches are live

  const soon = new Date(Date.now() + 35 * 60 * 1000).toISOString().slice(0, 16);
  const now = new Date().toISOString().slice(0, 16);
  const nearCount = db.prepare(`SELECT COUNT(*) as c FROM matches WHERE status = 'SCHEDULED' AND match_date BETWEEN ? AND ?`).get(now, soon).c;
  if (nearCount > 0) return 5 * 60 * 1000; // 5min in pre-kickoff window

  return 15 * 60 * 1000; // 15min otherwise
}

async function poll() {
  if (isPolling) return;
  isPolling = true;

  const db = getDb();
  let updatesM = 0, status = 'ok', errorMsg = null;
  const intervalUsed = getPollingInterval(db);

  try {
    const [liveMatches, todayMatches] = await Promise.all([fetchLiveMatches(), fetchTodayMatches()]);
    const allMatches = [...new Map([...liveMatches, ...todayMatches].map(m => [m.id, m])).values()];

    for (const fdMatch of allMatches) {
      if (updateMatchInDb(db, fdMatch)) updatesM++;
    }

    updatesM += updateScoresForFinished(db);

    if (pollerInterval) clearTimeout(pollerInterval);
    pollerInterval = setTimeout(poll, getPollingInterval(db));
  } catch (err) {
    status = 'error';
    errorMsg = err.message;
    console.error('[LivePoller] Error:', err.message);
    if (pollerInterval) clearTimeout(pollerInterval);
    pollerInterval = setTimeout(poll, 5 * 60 * 1000);
  } finally {
    isPolling = false;
    try {
      db.prepare(`INSERT INTO poll_log (active_matches, interval_seconds, updates_made, status, error) VALUES (?, ?, ?, ?, ?)`).run(
        db.prepare(`SELECT COUNT(*) as c FROM matches WHERE status IN ('IN_PLAY', 'PAUSED')`).get().c,
        Math.round(intervalUsed / 1000),
        updatesM,
        status,
        errorMsg
      );
    } catch (_) {}
  }
}

function start() {
  if (!process.env.FOOTBALL_DATA_KEY) {
    console.warn('[LivePoller] FOOTBALL_DATA_KEY not set – polling disabled');
    return;
  }
  console.log('[LivePoller] Starting');
  poll();
}

function stop() {
  if (pollerInterval) clearTimeout(pollerInterval);
}

module.exports = { start, stop, poll };
