'use strict';
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-8'; // Claude Opus 4.8

function buildPrompt(match, triggerType) {
  const stageMap = { group: 'Group Stage', r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarter-final', sf: 'Semi-final', final: 'Final', '3rd': '3rd Place' };
  return `You are competing in an AI prediction tournament for FIFA WM 2026.
Research all information needed and predict the score for:
${match.home_team} vs ${match.away_team} | ${match.match_date} | Stage: ${stageMap[match.stage] || match.stage}
Trigger: ${triggerType} (initial|t-1day|t-45min|ko-advance)

KO rules: tip result after full penalty shootout if needed. Draws valid (goes to extra time). Group stage = 90min only.
Scoring: 4pts exact, 3pts goal difference, 2pts tendency. Optimize for maximum expected prediction points.

Research: current form, injuries, suspensions, head-to-head, tournament context, bookmaker odds. Mention sources used.

Return ONLY valid JSON:
{
  "home": <int>,
  "away": <int>,
  "confidence": <0-100>,
  "summary": "<2-3 sentences: key reason, written for a curious non-expert audience>",
  "reasoning": "<full research trace: sources, odds found, injuries, form, why this scoreline maximizes expected points>"
}`;
}

async function predict(match, triggerType = 'initial') {
  const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{ role: 'user', content: buildPrompt(match, triggerType) }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('No text in Claude response');

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    const fs = require('fs');
    const path = require('path');
    const logDir = path.join(__dirname, '..', '..', 'data');
    const logPath = path.join(logDir, 'claude_errors.txt');
    const entry = `\n--- ${new Date().toISOString()} | ${match.home_team} vs ${match.away_team} ---\n${textBlock.text}\n`;
    fs.appendFileSync(logPath, entry);
    throw new Error('No JSON in Claude response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return validateTip(parsed, match);
}

function validateTip(parsed, match) {
  const home = parseInt(parsed.home, 10);
  const away = parseInt(parsed.away, 10);
  if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
    throw new Error(`Invalid score: ${parsed.home}:${parsed.away}`);
  }
  return {
    home,
    away,
    confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence, 10) || 50)),
    summary: String(parsed.summary || '').slice(0, 500),
    reasoning: String(parsed.reasoning || '').slice(0, 5000),
  };
}

module.exports = { predict };
