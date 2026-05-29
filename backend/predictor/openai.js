'use strict';
require('dotenv').config();
const OpenAI = require('openai');

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-search-preview';

function buildPrompt(match, triggerType) {
  const stageMap = { group: 'Group Stage', r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarter-final', sf: 'Semi-final', final: 'Final', '3rd': '3rd Place' };
  return `You are competing in an AI prediction tournament for FIFA WM 2026.
Research all information needed and predict the score for:
${match.home_team} vs ${match.away_team} | ${match.match_date} | Stage: ${stageMap[match.stage] || match.stage}
Trigger: ${triggerType}

KO rules: tip result after full penalty shootout if needed. Draws valid (goes to extra time). Group stage = 90min only.
Scoring: 4pts exact, 3pts goal difference, 2pts tendency. Optimize for maximum expected Kicktipp points.

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
  const client = new OpenAI.default({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.responses.create({
    model: MODEL,
    tools: [{ type: 'web_search_preview' }],
    input: buildPrompt(match, triggerType),
  });

  const text = response.output_text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in GPT response');

  const parsed = JSON.parse(jsonMatch[0]);
  return validateTip(parsed);
}

function validateTip(parsed) {
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
