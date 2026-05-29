'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { init } = require('./db');
const apiRouter = require('./routes/api');
const adminRouter = require('./routes/admin');

const PORT = process.env.PORT || 3000;
const app = express();

// Middleware
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin } : { origin: false }));
app.use(express.json());

// Routes
app.use('/api', apiRouter);
app.use('/api/admin', adminRouter);

// Serve frontend in production
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
if (require('fs').existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
}

app.use((err, req, res, _next) => {
  console.error('[Express]', err.message);
  res.status(500).json({ error: err.message });
});

async function main() {
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'changeme') {
    console.warn('\n⚠️  WARNING: ADMIN_PASSWORD is not set or is still "changeme". Set a strong password before deploying.\n');
  }

  init();

  app.listen(PORT, () => {
    console.log(`\n🌍 KickGPT WM-Predictor running on http://localhost:${PORT}`);
    console.log(`   API: http://localhost:${PORT}/api`);
    console.log(`   Admin: http://localhost:${PORT}/api/admin (needs X-Admin-Password header)\n`);
  });

  // Start live poller and scheduler
  try {
    require('./livePoller').start();
  } catch (err) {
    console.error('[Poller] Failed to start:', err.message);
  }

  try {
    require('./scheduler').start();
  } catch (err) {
    console.error('[Scheduler] Failed to start:', err.message);
  }

  // Generate daily image at 08:00
  const cron = require('node-cron');
  cron.schedule('0 8 * * *', async () => {
    try {
      const { generateDailyImage } = require('./imageGen');
      await generateDailyImage(require('./db').getDb());
    } catch (err) {
      console.error('[ImageGen] Daily run failed:', err.message);
    }
  });
}

main().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

const shutdown = () => {
  console.log('[KickGPT] Shutting down gracefully...');
  try { require('./db').getDb().close(); } catch (_) {}
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
