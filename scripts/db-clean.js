#!/usr/bin/env node
'use strict';
// Wipe all prediction data for a fresh start (keeps matches and models intact)
const { init, getDb } = require('../backend/db');

init();
const db = getDb();

const tx = db.transaction(() => {
  const tips      = db.prepare('DELETE FROM tips').run().changes;
  const history   = db.prepare('DELETE FROM tip_history').run().changes;
  const scores    = db.prepare('DELETE FROM scores').run().changes;
  const bonus     = db.prepare('DELETE FROM bonus_tips').run().changes;
  const bonusRes  = db.prepare('DELETE FROM bonus_results').run().changes;
  console.log(`Deleted: ${tips} tips, ${history} tip_history, ${scores} scores, ${bonus} bonus_tips, ${bonusRes} bonus_results`);
});
tx();

console.log('✓ Database cleaned. Ready for a fresh start.');
