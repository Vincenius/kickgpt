'use strict';
require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'predictor.db');

let db;

function getDb() {
  if (!db) throw new Error('DB not initialized – call init() first');
  return db;
}

const MODELS = [
  {
    name: 'claude',
    display_name: 'Claude Opus 4.7',
    tagline: 'Der Stratege – analysiert tief, wählt präzise',
    description: 'Anthropic\'s flagship model with deep reasoning and web search',
    color: '#8B5CF6',
    bg_color: '#1E1040',
    api_type: 'claude',
  },
  {
    name: 'gpt',
    display_name: 'GPT-5.5',
    tagline: 'Der Allrounder – breit informiert, selten überrascht',
    description: 'OpenAI\'s versatile model with broad knowledge and web search',
    color: '#10B981',
    bg_color: '#052E1C',
    api_type: 'openai',
  },
  {
    name: 'gemini',
    display_name: 'Gemini 3.1 Pro',
    tagline: 'Der Wissenschaftler – vertraut den Zahlen',
    description: 'Google\'s data-driven model with search grounding',
    color: '#3B82F6',
    bg_color: '#0C1A3A',
    api_type: 'gemini',
  },
  {
    name: 'grok',
    display_name: 'Grok 4.3',
    tagline: 'Der Insider – kennt die neuesten News von X',
    description: 'xAI\'s model with live X, web and news search',
    color: '#F97316',
    bg_color: '#2A1200',
    api_type: 'grok',
  },
  {
    name: 'terminator',
    display_name: 'TippTerminator',
    tagline: 'Die Maschine – reine Mathematik, kein Bauchgefühl',
    description: 'Dixon-Coles Poisson model powered by live betting odds',
    color: '#06B6D4',
    bg_color: '#021A20',
    api_type: 'terminator',
  },
];

// 12 groups × 4 teams
const GROUPS = {
  A: ['USA', 'Hungary', 'Senegal', 'New Zealand'],
  B: ['Canada', 'Denmark', 'Nigeria', 'Trinidad & Tobago'],
  C: ['Mexico', 'Poland', 'Algeria', 'Iraq'],
  D: ['Argentina', 'Croatia', 'Japan', 'Ghana'],
  E: ['Brazil', 'Switzerland', 'Morocco', 'Costa Rica'],
  F: ['France', 'Serbia', 'Saudi Arabia', 'Honduras'],
  G: ['England', 'Austria', 'Ivory Coast', 'Panama'],
  H: ['Spain', 'Ukraine', 'Australia', 'Cameroon'],
  I: ['Portugal', 'Scotland', 'Colombia', 'Tunisia'],
  J: ['Germany', 'Italy', 'Iran', 'Jamaica'],
  K: ['Netherlands', 'Uruguay', 'Egypt', 'Uzbekistan'],
  L: ['South Korea', 'Venezuela', 'Qatar', 'Ecuador'],
};

// Matchday base dates per group pair (2 groups share each date)
const GROUP_DATES = {
  A: ['2026-06-12', '2026-06-19', '2026-06-26'],
  B: ['2026-06-12', '2026-06-19', '2026-06-26'],
  C: ['2026-06-11', '2026-06-18', '2026-06-25'], // Mexico opening match
  D: ['2026-06-13', '2026-06-20', '2026-06-25'],
  E: ['2026-06-13', '2026-06-20', '2026-06-26'],
  F: ['2026-06-14', '2026-06-21', '2026-06-26'],
  G: ['2026-06-14', '2026-06-21', '2026-06-27'],
  H: ['2026-06-15', '2026-06-22', '2026-06-27'],
  I: ['2026-06-15', '2026-06-22', '2026-06-27'],
  J: ['2026-06-16', '2026-06-23', '2026-06-27'],
  K: ['2026-06-16', '2026-06-23', '2026-06-28'],
  L: ['2026-06-17', '2026-06-24', '2026-06-28'],
};

// Within each group: [T1,T2,T3,T4] → 6 matches across 3 matchdays
const GROUP_FIXTURES = [
  [0, 1, 1], // MD1: T1 vs T2
  [2, 3, 1], // MD1: T3 vs T4
  [0, 2, 2], // MD2: T1 vs T3
  [1, 3, 2], // MD2: T2 vs T4
  [0, 3, 3], // MD3: T1 vs T4 (simultaneous)
  [1, 2, 3], // MD3: T2 vs T3 (simultaneous)
];

// KO stage slot definitions
const KO_SLOTS = [
  // Round of 32 (16 matches)
  ...Array.from({ length: 16 }, (_, i) => ({
    stage: 'r32', matchday: i + 1,
    date: ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04'][Math.floor(i / 4)],
  })),
  // Round of 16 (8 matches)
  ...Array.from({ length: 8 }, (_, i) => ({
    stage: 'r16', matchday: i + 1,
    date: ['2026-07-06', '2026-07-07', '2026-07-08'][Math.floor(i / 3)],
  })),
  // Quarter-finals (4 matches)
  ...Array.from({ length: 4 }, (_, i) => ({
    stage: 'qf', matchday: i + 1,
    date: ['2026-07-12', '2026-07-13'][Math.floor(i / 2)],
  })),
  // Semi-finals (2 matches)
  { stage: 'sf', matchday: 1, date: '2026-07-15' },
  { stage: 'sf', matchday: 2, date: '2026-07-16' },
  // Third place
  { stage: '3rd', matchday: 1, date: '2026-07-19' },
  // Final
  { stage: 'final', matchday: 1, date: '2026-07-19' },
];

function buildGroupMatches() {
  const matches = [];
  for (const [group, teams] of Object.entries(GROUPS)) {
    const dates = GROUP_DATES[group];
    for (const [hi, ai, md] of GROUP_FIXTURES) {
      matches.push({
        home_team: teams[hi],
        away_team: teams[ai],
        stage: 'group',
        group_name: group,
        matchday: md,
        match_date: dates[md - 1],
      });
    }
  }
  return matches;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    tagline TEXT,
    description TEXT,
    color TEXT,
    bg_color TEXT,
    api_type TEXT,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT UNIQUE,
    home_team TEXT NOT NULL DEFAULT 'TBD',
    away_team TEXT NOT NULL DEFAULT 'TBD',
    stage TEXT NOT NULL,
    group_name TEXT,
    match_date TEXT,
    matchday INTEGER,
    venue TEXT,
    home_score INTEGER,
    away_score INTEGER,
    status TEXT DEFAULT 'SCHEDULED',
    minute INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL REFERENCES models(id),
    match_id INTEGER NOT NULL REFERENCES matches(id),
    home INTEGER NOT NULL,
    away INTEGER NOT NULL,
    confidence INTEGER DEFAULT 50,
    summary TEXT,
    reasoning TEXT,
    trigger_type TEXT DEFAULT 'initial',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(model_id, match_id)
  );

  CREATE TABLE IF NOT EXISTS tip_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL REFERENCES models(id),
    match_id INTEGER NOT NULL REFERENCES matches(id),
    home INTEGER NOT NULL,
    away INTEGER NOT NULL,
    confidence INTEGER,
    summary TEXT,
    reasoning TEXT,
    trigger_type TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL REFERENCES models(id),
    match_id INTEGER NOT NULL REFERENCES matches(id),
    points INTEGER DEFAULT 0,
    score_type TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(model_id, match_id)
  );

  CREATE TABLE IF NOT EXISTS bonus_tips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL REFERENCES models(id),
    question TEXT NOT NULL,
    candidates TEXT,
    reasoning TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(model_id, question)
  );

  CREATE TABLE IF NOT EXISTS bonus_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT UNIQUE NOT NULL,
    correct_answer TEXT,
    points_per_correct INTEGER DEFAULT 8,
    resolved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS poll_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    polled_at TEXT DEFAULT (datetime('now')),
    active_matches INTEGER DEFAULT 0,
    interval_seconds INTEGER,
    updates_made INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ok',
    error TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_tips_match ON tips(match_id);
  CREATE INDEX IF NOT EXISTS idx_tips_model ON tips(model_id);
  CREATE INDEX IF NOT EXISTS idx_scores_model ON scores(model_id);
  CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(match_date);
  CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
`;

function init() {
  const fs = require('fs');
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);

  seedModels();
  seedMatches();
  return db;
}

function seedModels() {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO models (name, display_name, tagline, description, color, bg_color, api_type)
    VALUES (@name, @display_name, @tagline, @description, @color, @bg_color, @api_type)
  `);
  const tx = db.transaction(() => MODELS.forEach(m => insert.run(m)));
  tx();
}

function seedMatches() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM matches').get().c;
  if (existing > 0) return;

  const insert = db.prepare(`
    INSERT INTO matches (home_team, away_team, stage, group_name, matchday, match_date)
    VALUES (@home_team, @away_team, @stage, @group_name, @matchday, @match_date)
  `);
  const insertKo = db.prepare(`
    INSERT INTO matches (home_team, away_team, stage, matchday, match_date)
    VALUES ('TBD', 'TBD', @stage, @matchday, @date)
  `);

  const tx = db.transaction(() => {
    buildGroupMatches().forEach(m => insert.run(m));
    KO_SLOTS.forEach(s => insertKo.run(s));
  });
  tx();
  console.log(`Seeded ${db.prepare('SELECT COUNT(*) as c FROM matches').get().c} matches`);
}

module.exports = { init, getDb, MODELS };
