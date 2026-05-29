#!/usr/bin/env node
'use strict';
// Tip all 72 group stage matches for all models (writes to DB)
require('dotenv').config();
const { init } = require('../backend/db');
const { tipMatches } = require('../backend/scheduler');

async function main() {
  init();
  const { getDb } = require('../backend/db');
  const db = getDb();

  const matches = db.prepare(`
    SELECT * FROM matches WHERE stage = 'group' AND matchday = 1 AND home_team != 'TBD'
    ORDER BY group_name, id
  `).all();

  console.log(`\n🌍 Tipping ${matches.length} MD1 matches (MD2/3 auto-trigger after results)`);
  console.log(`${'─'.repeat(60)}\n`);

  await tipMatches(matches, 'initial');

  const tipCount = db.prepare('SELECT COUNT(*) as c FROM tips').get().c;
  console.log(`\n✓ Done! ${tipCount} tips saved to database.\n`);
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
