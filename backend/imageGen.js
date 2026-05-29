'use strict';
const path = require('path');
const fs = require('fs');
const { getTotals } = require('./scoring');

const OUT_DIR = path.join(__dirname, '..', 'data', 'images');

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

async function generateDailyImage(db) {
  let Canvas;
  try {
    Canvas = require('canvas');
  } catch {
    console.warn('[ImageGen] canvas not installed – skipping image generation');
    return null;
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const { createCanvas } = Canvas;
  const canvas = createCanvas(1080, 1080);
  const ctx = canvas.getContext('2d');

  const models = getTotals(db);
  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

  // Background
  ctx.fillStyle = '#0A0A0F';
  ctx.fillRect(0, 0, 1080, 1080);

  // Gradient overlay
  const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
  grad.addColorStop(0, 'rgba(139,92,246,0.15)');
  grad.addColorStop(1, 'rgba(6,182,212,0.1)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1080);

  // Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏆 KI WM-Tipps Rangliste', 540, 80);

  ctx.fillStyle = '#9CA3AF';
  ctx.font = '30px sans-serif';
  ctx.fillText(`Stand: ${today}`, 540, 130);

  // Leaderboard
  models.forEach((m, i) => {
    const y = 200 + i * 155;
    const { r, g, b } = hexToRgb(m.color);

    // Row background
    ctx.fillStyle = i === 0 ? `rgba(${r},${g},${b},0.25)` : 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.roundRect(60, y, 960, 130, 16);
    ctx.fill();

    // Rank
    ctx.fillStyle = i === 0 ? m.color : '#6B7280';
    ctx.font = `bold ${i === 0 ? 60 : 48}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`#${i + 1}`, 90, y + 80);

    // Name
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${i === 0 ? 40 : 34}px sans-serif`;
    ctx.fillText(m.display_name, 200, y + 65);

    // Tagline
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '24px sans-serif';
    ctx.fillText(m.tagline.split(' – ')[0], 200, y + 105);

    // Points
    ctx.fillStyle = m.color;
    ctx.font = `bold ${i === 0 ? 56 : 48}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`${m.total_points} Pkt`, 990, y + 80);
  });

  // Footer
  ctx.fillStyle = '#4B5563';
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('kickgpt.app | AI World Cup Predictor', 540, 1040);

  const fileName = `leaderboard-${new Date().toISOString().slice(0, 10)}.png`;
  const outPath = path.join(OUT_DIR, fileName);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);

  console.log(`[ImageGen] Saved: ${outPath}`);
  return outPath;
}

module.exports = { generateDailyImage };
