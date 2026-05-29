'use strict';
require('dotenv').config();

const MODEL = process.env.MISTRAL_MODEL || 'mistral-large-latest';

function buildPrompt(match, triggerType) {
  const stageMap = { group: 'Group Stage', r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarter-final', sf: 'Semi-final', final: 'Final', '3rd': '3rd Place' };
  return `You are competing in an AI prediction tournament for FIFA WM 2026.
Research all information needed using your web search capabilities.
Predict the score for:
${match.home_team} vs ${match.away_team} | ${match.match_date} | Stage: ${stageMap[match.stage] || match.stage}
Trigger: ${triggerType}

KO rules: tip result after full penalty shootout if needed. Draws valid (goes to extra time). Group stage = 90min only.
Scoring: 4pts exact, 3pts goal difference, 2pts tendency. Optimize for maximum expected prediction points.

Research: current form, injuries, suspensions, head-to-head, tournament context, bookmaker odds. Mention sources used.

Return ONLY valid JSON (no markdown, no code block):
{
  "home": <int>,
  "away": <int>,
  "confidence": <0-100>,
  "summary": "<2-3 sentences: key reason, written for a curious non-expert audience>",
  "reasoning": "<full research trace: sources, odds found, injuries, form, why this scoreline maximizes expected points>"
}`;
}

function extractText(response) {
  for (const output of response.outputs || []) {
    if (output.type === 'message.output') {
      if (typeof output.content === 'string') return output.content;
      if (Array.isArray(output.content)) {
        return output.content.map(c => c.text ?? String(c)).join('');
      }
    }
  }
  return '';
}

async function predict(match, triggerType = 'initial') {
  const { Mistral } = require('@mistralai/mistralai');
  const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

  const response = await client.beta.conversations.start({
    model: MODEL,
    tools: [{ type: 'web_search' }],
    inputs: buildPrompt(match, triggerType),
    store: false,
  });

  const text = extractText(response);
  if (!text) throw new Error('No text in Mistral response');

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in Mistral response');

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
