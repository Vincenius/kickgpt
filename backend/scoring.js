'use strict';

function calculatePoints(tipHome, tipAway, resultHome, resultAway) {
  if (resultHome === null || resultAway === null) return null;

  const tipDiff = tipHome - tipAway;
  const resDiff = resultHome - resultAway;

  if (tipHome === resultHome && tipAway === resultAway) {
    return { points: 4, type: 'exact' };
  }
  if (tipDiff === resDiff) {
    return { points: 3, type: 'goal_diff' };
  }
  if (Math.sign(tipDiff) === Math.sign(resDiff)) {
    return { points: 2, type: 'tendency' };
  }
  return { points: 0, type: 'wrong' };
}

function recalculateAll(db) {
  const finishedMatches = db.prepare(`
    SELECT id, home_score, away_score FROM matches
    WHERE status = 'FINISHED' AND home_score IS NOT NULL
  `).all();

  const tips = db.prepare('SELECT * FROM tips WHERE match_id = ?');
  const upsertScore = db.prepare(`
    INSERT INTO scores (model_id, match_id, points, score_type)
    VALUES (@model_id, @match_id, @points, @score_type)
    ON CONFLICT(model_id, match_id) DO UPDATE SET points = @points, score_type = @score_type
  `);

  const tx = db.transaction(() => {
    let updated = 0;
    for (const match of finishedMatches) {
      const matchTips = tips.all(match.id);
      for (const tip of matchTips) {
        const result = calculatePoints(tip.home, tip.away, match.home_score, match.away_score);
        if (result) {
          upsertScore.run({ model_id: tip.model_id, match_id: match.id, ...result });
          updated++;
        }
      }
    }
    return updated;
  });

  return tx();
}

function getTotals(db) {
  return db.prepare(`
    SELECT m.id, m.name, m.display_name, m.tagline, m.color, m.bg_color,
           COALESCE(SUM(s.points), 0) as total_points,
           COUNT(s.id) as scored_matches,
           COALESCE(SUM(CASE WHEN s.score_type = 'exact' THEN 1 ELSE 0 END), 0) as exact_count,
           COALESCE(SUM(CASE WHEN s.score_type = 'goal_diff' THEN 1 ELSE 0 END), 0) as goal_diff_count,
           COALESCE(SUM(CASE WHEN s.score_type = 'tendency' THEN 1 ELSE 0 END), 0) as tendency_count,
           COALESCE(SUM(CASE WHEN s.score_type = 'wrong' THEN 1 ELSE 0 END), 0) as wrong_count
    FROM models m
    LEFT JOIN scores s ON s.model_id = m.id
    WHERE m.is_active = 1
    GROUP BY m.id
    ORDER BY total_points DESC
  `).all();
}

function getByStage(db) {
  return db.prepare(`
    SELECT s.model_id, ma.stage, COALESCE(SUM(s.points), 0) as points
    FROM scores s
    JOIN matches ma ON ma.id = s.match_id
    GROUP BY s.model_id, ma.stage
  `).all();
}

module.exports = { calculatePoints, recalculateAll, getTotals, getByStage };
