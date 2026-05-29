#!/usr/bin/env node
'use strict';
// Dry run: tip Group A matches only, no DB writes, console output
require('dotenv').config();
const { init, getDb } = require('../backend/db');
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
  init();
  const db = getDb();

  const matches = db.prepare(`SELECT * FROM matches WHERE group_name = 'A' ORDER BY matchday, id`).all();
  console.log(`\n🔍 DRY RUN – Group A (${matches.length} matches)\n${'─'.repeat(60)}`);

  for (const match of matches) {
    console.log(`\n⚽ ${match.home_team} vs ${match.away_team} (${match.match_date})`);

    for (const [name, predictor] of Object.entries(predictors)) {
      if (!process.env[ENV_KEYS[name]]) {
        console.log(`  ${name}: SKIPPED (no API key)`);
        continue;
      }

      try {
        const tip = await predictor.predict(match, 'initial');
        console.log(`  ${name}: ${tip.home}:${tip.away} (confidence: ${tip.confidence}%)`);
        console.log(`    → ${tip.summary}`);
      } catch (err) {
        console.error(`  ${name}: ERROR – ${err.message}`);
      }
    }
  }

  console.log('\n✓ Dry run complete. No DB writes were made.\n');
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
