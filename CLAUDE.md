# KickGPT

AI World Cup Predictor 2026 — 5 models compete on 104 matches.

## Dev

```
npm run dev        # starts both backend (port 3000) and frontend (Vite, port 5173)
npm run tip:all    # run all AI predictions
```

## Structure

- `backend/` — Express API, SQLite at `data/predictor.db`, scheduler, live poller
- `backend/predictor/` — one file per model (claude, openai, gemini, grok, terminator)
- `frontend/src/pages/` — Home (standings + matches merged), KiProfile, Privacy
- `frontend/src/components/` — MatchCard, ConsensusBar, ReasoningPanel, LiveTicker, ModelCard

## Key constraints

- Node.js 24 requires `better-sqlite3 v11+`
- Frontend proxies `/api/*` to backend via `vite.config.js`
- Model personality strings (`tagline` DB field) are intentionally not shown in the UI
- Light theme — no dark mode, no emojis in UI copy
