import test from "node:test";
import assert from "node:assert/strict";
import { aggregateSeasonPlayers } from "../lib/simulation/seasonAnalytics.mjs";

test("season averages ignore cameos below 15 minutes and enforce early eligibility", () => {
  const rows = [
    { player_id: "p1", team_id: "t1", minutes: 90, rating: 7, goals: 1 },
    { player_id: "p1", team_id: "t1", minutes: 10, rating: 9, goals: 0 },
    { player_id: "p1", team_id: "t1", minutes: 45, rating: 6, goals: 0 },
    { player_id: "p1", team_id: "t1", minutes: 30, rating: 8, goals: 0 },
  ];
  const [player] = aggregateSeasonPlayers(rows, { teamMatchesPlayed: new Map([["t1", 4]]) });
  assert.equal(player.appearances, 4);
  assert.equal(player.qualifyingAppearances, 3);
  assert.equal(player.averageRating, 6.91);
  assert.equal(player.leaderboardEligible, true);
});
