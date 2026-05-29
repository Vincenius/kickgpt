#!/usr/bin/env node
'use strict';
// Tip Group A matches for all models and save results to DB
require('dotenv').config();
const { init, getDb } = require('../backend/db');
const { saveTip } = require('../backend/scheduler');

const predictors = {
  claude: require('../backend/predictor/claude'),
  gpt: require('../backend/predictor/openai'),
  gemini: require('../backend/predictor/gemini'),
  grok: require('../backend/predictor/grok'),
  terminator: require('../backend/predictor/terminator'),
};

const ENV_KEYS = {
  claude: 'ANTHROPIC_API_KEY',
  gpt: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  grok: 'GROK_API_KEY',
  terminator: 'ODDS_API_KEY',
};

async function main() {
  // --model <name> to run only one predictor, e.g. node tip-dry.js --model gpt
  const modelFlag = (() => {
    const i = process.argv.indexOf('--model');
    return i !== -1 ? process.argv[i + 1] : null;
  })();

  if (modelFlag && !predictors[modelFlag]) {
    console.error(`Unknown model "${modelFlag}". Available: ${Object.keys(predictors).join(', ')}`);
    process.exit(1);
  }

  init();
  const db = getDb();

  const matches = db.prepare(`SELECT * FROM matches WHERE group_name = 'A' ORDER BY matchday, id`).all();
  console.log(`\n⚽ Group A – ${matches.length} matches${modelFlag ? ` (model: ${modelFlag})` : ''}\n${'─'.repeat(60)}`);

  for (const match of matches) {
    console.log(`\n${match.home_team} vs ${match.away_team} (${match.match_date})`);

    const activeEntries = modelFlag
      ? Object.entries(predictors).filter(([name]) => name === modelFlag)
      : Object.entries(predictors);

    for (const [name, predictor] of activeEntries) {
      if (!process.env[ENV_KEYS[name]]) {
        console.log(`  ${name}: SKIPPED (no API key)`);
        continue;
      }

      try {
        const tip = await predictor.predict(match, 'initial');
        saveTip(db, match, name, tip, 'initial');
        console.log(`  ${name}: ${tip.home}:${tip.away} (${tip.confidence}%) ✓`);
        console.log(`    → ${tip.summary}`);
      } catch (err) {
        console.error(`  ${name}: ERROR – ${err.message}`);
      }
    }
  }

  const tipCount = db.prepare('SELECT COUNT(*) as c FROM tips').get().c;
  console.log(`\n✓ Done! ${tipCount} tips in database.\n`);
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
