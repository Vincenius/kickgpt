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
  return { claude: 'ANTHROPIC_API_KEY', gpt: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', grok: 'GROK_API_KEY', terminator: 'ODDS_API_KEY' }[name];
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function start() {
  const db = getDb();

  // T-1 day 09:00: re-evaluate tomorrow's matches
  cron.schedule('0 9 * * *', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 10);
    const matches = db.prepare(`SELECT * FROM matches WHERE match_date = ? AND status = 'SCHEDULED' AND home_team != 'TBD'`).all(dateStr);
    if (matches.length) {
      console.log(`[Scheduler] T-1 day run: ${matches.length} matches on ${dateStr}`);
      await tipMatches(matches, 't-1day');
    }
  });

  // T-45min: final update per match (runs every minute, checks window)
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 44 * 60 * 1000).toISOString().slice(0, 16);
    const windowEnd = new Date(now.getTime() + 46 * 60 * 1000).toISOString().slice(0, 16);
    const matches = db.prepare(`
      SELECT * FROM matches WHERE status = 'SCHEDULED' AND home_team != 'TBD'
      AND match_date || 'T' || COALESCE(match_time, '20:00') BETWEEN ? AND ?
    `).all(windowStart, windowEnd);

    if (matches.length) {
      console.log(`[Scheduler] T-45min run: ${matches.length} matches`);
      await tipMatches(matches, 't-45min');
    }
  });

  console.log('[Scheduler] Cron jobs registered');
}

async function triggerKoAdvance(matchId) {
  const db = getDb();
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!match || match.home_team === 'TBD' || match.away_team === 'TBD') return;

  const alreadyTipped = db.prepare('SELECT COUNT(*) as c FROM tips WHERE match_id = ?').get(matchId).c;
  if (alreadyTipped === 5) return; // all models already have tips

  console.log(`[Scheduler] KO advance tip: ${match.home_team} vs ${match.away_team}`);
  await tipMatches([match], 'ko-advance');
}

module.exports = { start, tipMatches, saveTip, triggerKoAdvance };
