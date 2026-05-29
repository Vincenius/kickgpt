'use strict';
const cron = require('node-cron');
const { getDb } = require('./db');

const MAX_RETRIES = 3;
const RETRY_DELAY = 10 * 60 * 1000;

async function runTipWithRetry(predictorFn, match, triggerType, modelName, attempt = 1) {
  const { getDb } = require('./db');
  const db = getDb();

  try {
    console.log(`[Scheduler] Tipping ${match.home_team} vs ${match.away_team} with ${modelName} (trigger=${triggerType}, attempt=${attempt})`);
    const tip = await predictorFn(match, triggerType);
    saveTip(db, match, modelName, tip, triggerType);
    console.log(`[Scheduler] ✓ ${modelName}: ${match.home_team} ${tip.home}:${tip.away} ${match.away_team}`);
  } catch (err) {
    console.error(`[Scheduler] ✗ ${modelName} failed (attempt ${attempt}): ${err.message}`);
    if (attempt < MAX_RETRIES) {
      setTimeout(() => runTipWithRetry(predictorFn, match, triggerType, modelName, attempt + 1), RETRY_DELAY);
    } else {
      console.error(`[Scheduler] Giving up on ${modelName} for ${match.home_team} vs ${match.away_team} after ${MAX_RETRIES} attempts`);
    }
  }
}

function saveTip(db, match, modelName, tip, triggerType) {
  const model = db.prepare('SELECT id FROM models WHERE name = ?').get(modelName);
  if (!model) throw new Error(`Unknown model: ${modelName}`);

  // Archive current tip to history
  const existing = db.prepare('SELECT * FROM tips WHERE model_id = ? AND match_id = ?').get(model.id, match.id);
  if (existing) {
    db.prepare(`INSERT INTO tip_history (model_id, match_id, home, away, confidence, summary, reasoning, trigger_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      existing.model_id, existing.match_id, existing.home, existing.away,
      existing.confidence, existing.summary, existing.reasoning, existing.trigger_type
    );
  }

  db.prepare(`
    INSERT INTO tips (model_id, match_id, home, away, confidence, summary, reasoning, trigger_type, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(model_id, match_id) DO UPDATE SET
      home = excluded.home, away = excluded.away, confidence = excluded.confidence,
      summary = excluded.summary, reasoning = excluded.reasoning, trigger_type = excluded.trigger_type,
      updated_at = datetime('now')
  `).run(model.id, match.id, tip.home, tip.away, tip.confidence, tip.summary, tip.reasoning, triggerType);
}

function getModels() {
  return {
    claude: require('./predictor/claude'),
    gpt: require('./predictor/openai'),
    gemini: require('./predictor/gemini'),
    grok: require('./predictor/grok'),
    terminator: require('./predictor/terminator'),
    mistral: require('./predictor/mistral'),
  };
}

async function tipMatches(matches, triggerType) {
  const models = getModels();
  for (const match of matches) {
    for (const [name, predictor] of Object.entries(models)) {
      if (!process.env[envKey(name)]) {
        console.warn(`[Scheduler] Skipping ${name} – API key missing`);
        continue;
      }
      await runTipWithRetry(predictor.predict, match, triggerType, name);
      await delay(1000); // rate limit buffer
    }
  }
}

function envKey(name) {
  return { claude: 'ANTHROPIC_API_KEY', gpt: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', grok: 'GROK_API_KEY', terminator: 'ODDS_API_KEY', mistral: 'MISTRAL_API_KEY' }[name];
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function start() {
  const db = getDb();

  // T-45min: final update for KO matches only (group stage is handled round-by-round)
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 44 * 60 * 1000).toISOString().slice(0, 16);
    const windowEnd = new Date(now.getTime() + 46 * 60 * 1000).toISOString().slice(0, 16);
    const matches = db.prepare(`
      SELECT * FROM matches WHERE status = 'SCHEDULED' AND home_team != 'TBD' AND stage != 'group'
      AND match_date || 'T' || COALESCE(match_time, '20:00') BETWEEN ? AND ?
    `).all(windowStart, windowEnd);

    if (matches.length) {
      console.log(`[Scheduler] T-45min run: ${matches.length} matches`);
      await tipMatches(matches, 't-45min');
    }
  });

  console.log('[Scheduler] Cron jobs registered');
}

// Tracks which group/matchday combos have already been triggered this process lifetime.
// The alreadyTipped DB check prevents double-tipping across restarts.
const triggeredRounds = new Set();

async function checkGroupRounds() {
  const db = getDb();
  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  for (const group of groups) {
    for (const nextMd of [2, 3]) {
      const key = `${group}-${nextMd}`;
      if (triggeredRounds.has(key)) continue;

      const prevMd = nextMd - 1;
      const prev = db.prepare(`
        SELECT COUNT(*) as total, SUM(CASE WHEN status = 'FINISHED' THEN 1 ELSE 0 END) as done
        FROM matches WHERE stage = 'group' AND group_name = ? AND matchday = ?
      `).get(group, prevMd);

      if (!prev || prev.total === 0 || prev.done < prev.total) continue;

      const alreadyTipped = db.prepare(`
        SELECT COUNT(DISTINCT t.match_id) as c FROM tips t
        JOIN matches ma ON ma.id = t.match_id
        WHERE ma.stage = 'group' AND ma.group_name = ? AND ma.matchday = ?
      `).get(group, nextMd).c;

      if (alreadyTipped > 0) { triggeredRounds.add(key); continue; }

      triggeredRounds.add(key);
      const matches = db.prepare(
        `SELECT * FROM matches WHERE stage = 'group' AND group_name = ? AND matchday = ? ORDER BY id`
      ).all(group, nextMd);
      if (!matches.length) continue;

      console.log(`[Scheduler] Group ${group} MD${prevMd} complete — predicting MD${nextMd}`);
      tipMatches(matches, 'md-advance').catch(err =>
        console.error(`[Scheduler] Group ${group} MD${nextMd} prediction failed:`, err.message)
      );
    }
  }
}

async function triggerKoAdvance(matchId) {
  const db = getDb();
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!match || match.home_team === 'TBD' || match.away_team === 'TBD') return;

  const alreadyTipped = db.prepare('SELECT COUNT(*) as c FROM tips WHERE match_id = ?').get(matchId).c;
  if (alreadyTipped === 6) return; // all models already have tips

  console.log(`[Scheduler] KO advance tip: ${match.home_team} vs ${match.away_team}`);
  await tipMatches([match], 'ko-advance');
}

module.exports = { start, tipMatches, saveTip, triggerKoAdvance, checkGroupRounds };
