'use strict';
require('dotenv').config();
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { recalculateAll } = require('../scoring');
const { poll } = require('../livePoller');
const { tipMatches, saveTip, triggerKoAdvance } = require('../scheduler');
const { generateDailyImage } = require('../imageGen');
const path = require('path');
const fs = require('fs');

const ALLOWED_PREDICTOR_FILES = new Set(['claude', 'openai', 'gemini', 'grok', 'terminator']);

function auth(req, res, next) {
  const pass = req.headers['x-admin-password'] || req.query.password;
  if (!process.env.ADMIN_PASSWORD || !pass || pass !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.use(auth);

router.post('/trigger-tip', async (req, res) => {
  const db = getDb();
  const { match_id, trigger_type = 'initial', model_name } = req.body;
  if (!match_id) return res.status(400).json({ error: 'match_id required' });

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(match_id);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  try {
    let results;
    if (model_name) {
      const file = model_name === 'gpt' ? 'openai' : model_name;
      if (!ALLOWED_PREDICTOR_FILES.has(file)) {
        return res.status(400).json({ error: `Unknown model: ${model_name}` });
      }
      const predictor = require(`../predictor/${file}`);
      const tip = await predictor.predict(match, trigger_type);
      saveTip(db, match, model_name, tip, trigger_type);
      results = [{ model: model_name, ...tip }];
    } else {
      await tipMatches([match], trigger_type);
      results = db.prepare('SELECT t.*, m.name FROM tips t JOIN models m ON m.id = t.model_id WHERE t.match_id = ?').all(match.id);
    }
    res.json({ ok: true, match, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/trigger-ko-advance', async (req, res) => {
  const { match_id } = req.body;
  if (!match_id) return res.status(400).json({ error: 'match_id required' });
  try {
    await triggerKoAdvance(match_id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/trigger-poller', async (req, res) => {
  try {
    await poll();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/recalculate-scores', (req, res) => {
  try {
    const db = getDb();
    const count = recalculateAll(db);
    res.json({ ok: true, updated: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tip-history/:matchId', (req, res) => {
  const db = getDb();
  const history = db.prepare(`
    SELECT th.*, m.display_name, m.color FROM tip_history th
    JOIN models m ON m.id = th.model_id
    WHERE th.match_id = ?
    ORDER BY th.created_at DESC
  `).all(req.params.matchId);
  res.json(history);
});

router.post('/generate-image', async (req, res) => {
  try {
    const db = getDb();
    const filePath = await generateDailyImage(db);
    res.json({ ok: true, path: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/update-match-result', (req, res) => {
  const db = getDb();
  const { match_id, home_score, away_score, status } = req.body;
  if (!match_id) return res.status(400).json({ error: 'match_id required' });
  db.prepare(`UPDATE matches SET home_score = ?, away_score = ?, status = ?, updated_at = datetime('now') WHERE id = ?`).run(home_score, away_score, status || 'FINISHED', match_id);
  recalculateAll(db);
  res.json({ ok: true });
});

router.post('/resolve-bonus', (req, res) => {
  const db = getDb();
  const { question, correct_answer } = req.body;
  if (!question || !correct_answer) return res.status(400).json({ error: 'question and correct_answer required' });

  db.prepare(`
    INSERT INTO bonus_results (question, correct_answer, resolved_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(question) DO UPDATE SET correct_answer = ?, resolved_at = datetime('now')
  `).run(question, correct_answer, correct_answer);

  res.json({ ok: true });
});

router.get('/poll-log', (req, res) => {
  const db = getDb();
  const logs = db.prepare('SELECT * FROM poll_log ORDER BY polled_at DESC LIMIT 50').all();
  res.json(logs);
});

router.get('/matches-all', (req, res) => {
  const db = getDb();
  const matches = db.prepare('SELECT * FROM matches ORDER BY match_date, id').all();
  res.json(matches);
});

// Serve daily image
router.get('/image/latest', (req, res) => {
  const dir = path.join(__dirname, '../../data/images');
  if (!fs.existsSync(dir)) return res.status(404).json({ error: 'No images yet' });
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort().reverse();
  if (!files.length) return res.status(404).json({ error: 'No images yet' });
  res.sendFile(path.join(dir, files[0]));
});

module.exports = router;
