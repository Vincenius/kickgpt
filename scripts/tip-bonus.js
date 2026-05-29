#!/usr/bin/env node
'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { init } = require('../backend/db');

const TOURNAMENT_START = '2026-06-11';

const BONUS_QUESTIONS = [
  'World Champion 2026',
  'Top Scorer 2026',
  "Top Scorer's Team 2026",
  'Group A Winner',
  'Group B Winner',
  'Group C Winner',
  'Group D Winner',
  'Group E Winner',
  'Group F Winner',
  'Group G Winner',
  'Group H Winner',
  'Group I Winner',
  'Group J Winner',
  'Group K Winner',
  'Group L Winner',
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

async function callModelForBonus(modelName, prompt) {
  if (modelName === 'claude') {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
    const messages = [{ role: 'user', content: prompt }];
    let r;
    for (let iter = 0; iter < 10; iter++) {
      r = await client.messages.create({
        model: process.env.CLAUDE_MODEL || 'claude-opus-4-8',
        max_tokens: 2048,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages,
      });
      if (r.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: r.content });
    }
    return r.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  }
  if (modelName === 'gpt') {
    const OpenAI = require('openai');
    const client = new OpenAI.default({ apiKey: process.env.OPENAI_API_KEY });
    const r = await client.responses.create({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', tools: [{ type: 'web_search_preview' }], input: prompt });
    return r.output_text;
  }
  if (modelName === 'gemini') {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-3.1-pro-preview', tools: [{ googleSearch: {} }] });
    const r = await model.generateContent(prompt);
    return r.response.text();
  }
  if (modelName === 'grok') {
    const OpenAI = require('openai');
    const client = new OpenAI.default({ apiKey: process.env.GROK_API_KEY, baseURL: 'https://api.x.ai/v1' });
    const r = await client.responses.create({
      model: process.env.GROK_MODEL || 'grok-4.3',
      tools: [{ type: 'web_search' }],
      input: prompt,
    });
    return r.output_text;
  }
  if (modelName === 'terminator') {
    return JSON.stringify({ question: prompt, candidates: [{ name: 'N/A – algorithm cannot answer bonus questions', probability: 0, reasoning: 'OddsBot only predicts match scores using statistical models.' }] });
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

  const today = new Date().toISOString().split('T')[0];
  const tournamentStarted = today >= TOURNAMENT_START ||
    db.prepare("SELECT COUNT(*) as c FROM matches WHERE status != 'SCHEDULED'").get().c > 0;
  const existingBonusTips = db.prepare('SELECT COUNT(*) as c FROM bonus_tips').get().c;

  if (existingBonusTips > 0 && tournamentStarted) {
    console.log('\nBonus tips are locked — tournament has started. Skipping regeneration.\n');
    process.exit(0);
  }

  console.log(`\nTipping ${BONUS_QUESTIONS.length} bonus questions...\n`);
  const bonusResults = {};

  for (const question of BONUS_QUESTIONS) {
    console.log(`\n❓ ${question}`);

    for (const [name, envKey] of Object.entries(ENV_KEYS)) {
      if (!process.env[envKey]) continue;
      try {
        const text = await callModelForBonus(name, BONUS_PROMPT(question));
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) { console.error(`  ${name}: no JSON found`); continue; }
        const parsed = JSON.parse(jsonMatch[0]);
        if (!bonusResults[question]) bonusResults[question] = {};
        bonusResults[question][name] = parsed;
        console.log(`  ${name}: ✓`);

        const model = db.prepare('SELECT id FROM models WHERE name = ?').get(name);
        if (model) {
          db.prepare(`
            INSERT INTO bonus_tips (model_id, question, candidates, reasoning)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(model_id, question) DO UPDATE SET candidates = ?, reasoning = ?
          `).run(
            model.id, question,
            JSON.stringify(parsed.candidates),
            parsed.candidates?.[0]?.reasoning || '',
            JSON.stringify(parsed.candidates),
            parsed.candidates?.[0]?.reasoning || '',
          );
        }
      } catch (err) {
        console.error(`  ${name}: ERROR – ${err.message}`);
      }
    }
  }

  const outPath = path.join(__dirname, '..', 'data', 'bonus_tips.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(bonusResults, null, 2));
  console.log(`\n✓ Bonus tips saved to ${outPath}`);
  console.log(`✓ ${BONUS_QUESTIONS.length} bonus questions processed\n`);
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
