'use strict';
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

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
  "home": <int, goals for ${match.home_team}>,
  "away": <int, goals for ${match.away_team}>,
  "confidence": <0-100>,
  "summary": "<2-3 sentences: key reason, written for a curious non-expert audience>",
  "reasoning": "<full research trace: sources, odds found, injuries, form, why this scoreline maximizes expected points>"
}
IMPORTANT: "home" = ${match.home_team} goals, "away" = ${match.away_team} goals. Your summary and reasoning MUST reflect the team your score predicts to win (or a draw). Do not write that one team is favored if your score shows the other team winning.`;
}

async function predict(match, triggerType = 'initial') {
  const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages = [{ role: 'user', content: buildPrompt(match, triggerType) }];
  let response;

  // Server-side web_search runs internally; loop if it hits the iteration limit (pause_turn).
  // Retry up to 3 times on rate limit (429) with 65s backoff each attempt.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      for (let iter = 0; iter < 10; iter++) {
        response = await client.messages.create({
          model: MODEL,
          max_tokens: 4096,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages,
        });
        if (response.stop_reason !== 'pause_turn') break;
        messages.push({ role: 'assistant', content: response.content });
      }
      break; // success
    } catch (err) {
      if (err?.status === 429 && attempt < 2) {
        const waitMs = 65000 * (attempt + 1);
        console.warn(`  claude: rate limited, retrying in ${waitMs / 1000}s…`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }

  // The response may contain multiple text blocks: an intro, then the final answer.
  // Search from last to first so we find the block that contains the JSON.
  const textBlocks = response.content.filter(b => b.type === 'text');
  for (let i = textBlocks.length - 1; i >= 0; i--) {
    const jsonMatch = textBlocks[i].text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return validateTip(parsed, match);
    }
  }

  const fs = require('fs');
  const path = require('path');
  const allText = textBlocks.map(b => b.text).join('\n---\n');
  const logPath = path.join(__dirname, '..', '..', 'data', 'claude_errors.txt');
  const entry = `\n--- ${new Date().toISOString()} | ${match.home_team} vs ${match.away_team} ---\n${allText}\n`;
  fs.appendFileSync(logPath, entry);
  throw new Error('No JSON in Claude response');
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
