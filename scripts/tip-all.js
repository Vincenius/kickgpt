#!/usr/bin/env node
'use strict';
// Tip all group stage matches + generate bonus_tips.json
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { init } = require('../backend/db');
const { tipMatches, saveTip } = require('../backend/scheduler');

const BONUS_QUESTIONS = [
  'Weltmeister 2026',
  'Torschützenkönig 2026',
  'Torschützenkönigin-Team 2026',
  'Gruppensieger A',
  'Gruppensieger B',
  'Gruppensieger C',
  'Gruppensieger D',
  'Gruppensieger E',
  'Gruppensieger F',
  'Gruppensieger G',
  'Gruppensieger H',
  'Gruppensieger I',
  'Gruppensieger J',
  'Gruppensieger K',
  'Gruppensieger L', // 15 total (14 group winners + champion + top scorer)
];

const BONUS_PROMPT = (question) => `You are competing in an AI prediction tournament for FIFA WM 2026.
Answer the following bonus question: "${question}"

Research the current state of the tournament, team/player form, and bookmaker odds.
Return top-3 candidates with implied probability and 2-sentence reasoning.

Return ONLY valid JSON:
{
  "question": "${question}",
  "candidates": [
    {"name": "<name>", "probability": <0-100>, "reasoning": "<2 sentences>"},
    {"name": "<name>", "probability": <0-100>, "reasoning": "<2 sentences>"},
    {"name": "<name>", "probability": <0-100>, "reasoning": "<2 sentences>"}
  ]
}`;

async function tipBonusQuestion(question, predictors, ENV_KEYS) {
  const results = {};

  for (const [name, predictor] of Object.entries(predictors)) {
    if (!process.env[ENV_KEYS[name]]) continue;

    try {
      // Use a fake "match" object to pass the bonus prompt
      const fakeMatch = {
        home_team: question, away_team: '', match_date: '2026-07-19',
        stage: 'bonus', group_name: null, matchday: null,
        id: null,
      };

      // Call predict with the bonus prompt by passing the question as home_team
      // Actually, let's call the API directly for bonus questions
      const text = await callModelForBonus(name, BONUS_PROMPT(question));
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        results[name] = parsed;
        console.log(`  ${name}: ✓`);
      }
    } catch (err) {
      console.error(`  ${name}: ERROR – ${err.message}`);
    }
  }

  return results;
}

async function callModelForBonus(modelName, prompt) {
  if (modelName === 'claude') {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
    const r = await client.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-opus-4-8',
      max_tokens: 1024,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    });
    return r.content.find(b => b.type === 'text')?.text || '';
  }
  if (modelName === 'gpt') {
    const OpenAI = require('openai');
    const client = new OpenAI.default({ apiKey: process.env.OPENAI_API_KEY });
    const r = await client.responses.create({ model: 'gpt-4o-search-preview', tools: [{ type: 'web_search_preview' }], input: prompt });
    return r.output_text;
  }
  if (modelName === 'gemini') {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-pro', tools: [{ googleSearch: {} }] });
    const r = await model.generateContent(prompt);
    return r.response.text();
  }
  if (modelName === 'grok') {
    const OpenAI = require('openai');
    const client = new OpenAI.default({ apiKey: process.env.GROK_API_KEY, baseURL: 'https://api.x.ai/v1' });
    const r = await client.chat.completions.create({
      model: process.env.GROK_MODEL || 'grok-3',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });
    return r.choices[0].message.content;
  }
  if (modelName === 'terminator') {
    return JSON.stringify({ question: prompt, candidates: [{ name: 'N/A – algorithm cannot answer bonus questions', probability: 0, reasoning: 'TippTerminator only predicts match scores using statistical models.' }] });
  }
  throw new Error(`Unknown model: ${modelName}`);
}

async function main() {
  init();
  const { getDb } = require('../backend/db');
  const db = getDb();

  const ENV_KEYS = {
    claude: 'ANTHROPIC_API_KEY',
    gpt: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
    grok: 'GROK_API_KEY',
    terminator: 'ODDS_API_KEY',
  };

  const predictors = {
    claude: require('../backend/predictor/claude'),
    gpt: require('../backend/predictor/openai'),
    gemini: require('../backend/predictor/gemini'),
    grok: require('../backend/predictor/grok'),
    terminator: require('../backend/predictor/terminator'),
  };

  // 1. Tip all group stage matches
  const matches = db.prepare(`SELECT * FROM matches WHERE stage = 'group' AND home_team != 'TBD' ORDER BY matchday, group_name, id`).all();
  console.log(`\n🌍 Step 1: Tipping ${matches.length} group stage matches...\n`);
  await tipMatches(matches, 'initial');

  // 2. Tip bonus questions
  console.log(`\n🎯 Step 2: Tipping ${BONUS_QUESTIONS.length} bonus questions...\n`);
  const bonusResults = {};

  for (const question of BONUS_QUESTIONS) {
    console.log(`\n❓ ${question}`);
    const results = await tipBonusQuestion(question, predictors, ENV_KEYS);
    bonusResults[question] = results;

    // Save to DB
    for (const [modelName, result] of Object.entries(results)) {
      const model = db.prepare('SELECT id FROM models WHERE name = ?').get(modelName);
      if (!model) continue;
      db.prepare(`
        INSERT INTO bonus_tips (model_id, question, candidates, reasoning)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(model_id, question) DO UPDATE SET candidates = ?, reasoning = ?
      `).run(
        model.id, question,
        JSON.stringify(result.candidates),
        result.candidates?.[0]?.reasoning || '',
        JSON.stringify(result.candidates),
        result.candidates?.[0]?.reasoning || '',
      );
    }
  }

  // Save to bonus_tips.json
  const outPath = path.join(__dirname, '..', 'data', 'bonus_tips.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(bonusResults, null, 2));
  console.log(`\n✓ Bonus tips saved to ${outPath}`);

  const tipCount = db.prepare('SELECT COUNT(*) as c FROM tips').get().c;
  console.log(`✓ ${tipCount} match tips in database`);
  console.log(`✓ ${BONUS_QUESTIONS.length} bonus questions processed\n`);
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
