import test from "node:test";
import assert from "node:assert/strict";

import { buildAnalyticsPersistence } from "../lib/simulation/persistence.mjs";

test("builds idempotent persistence rows from a v2 match result", () => {
  const result = {
    matchId: "match-1", engineVersion: "fc25-il-2", calibrationVersion: "sofascore-v1", source: "simulated",
    teamStats: { home: { possession: 55, fieldTilt: 61, xgot: 1.4 }, away: { possession: 45, fieldTilt: 39, xgot: 0.6 } },
    playerStats: [{ playerId: "p1", teamId: "home", minutes: 90, rating: 7.2, xg: 0.4, heatmap: [0, 1], ratingComponents: { base: 6.65 } }],
    tracking: { chunks: [{ index: 0, frames: [{ second: 0 }, { second: 5 }] }] },
  };
  const rows = buildAnalyticsPersistence(result, { leagueId: "league-1", season: 3, competitionType: "domestic" });
  assert.equal(rows.match.simulation_engine_version, "fc25-il-2");
  assert.equal(rows.teamStats[0].field_tilt, 61);
  assert.deepEqual(rows.playerStats[0].heatmap, [0, 1]);
  assert.equal(rows.trackingChunks[0].starts_at_second, 0);
  assert.equal(rows.trackingChunks[0].ends_at_second, 5);
});
