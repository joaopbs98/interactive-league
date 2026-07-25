import test from "node:test";
import assert from "node:assert/strict";
import { buildSimulationPlayer, toPlayerIds, mapSimulationSettings } from "../lib/simulation/adapter.mjs";

test("normalizes mixed lineup JSON into ordered player IDs", () => {
  assert.deepEqual(toPlayerIds(["a", { player_id: "b" }, { playerId: "c" }, null, {}]), ["a", "b", "c"]);
});

test("maps save-scoped snake-case attributes into engine input", () => {
  const player = buildSimulationPlayer({ player_id: "p1", player_name: "Player", positions: "ST,CF", rating: 81, short_passing: 77, gk_reflexes: null });
  assert.equal(player.playerId, "p1");
  assert.equal(player.position, "ST");
  assert.equal(player.shortPassing, 77);
  assert.equal(player.gkReflexes, 81);
});

test("maps save-scoped availability without changing the source player", () => {
  const source = { player_id: "p2", player_name: "Tired Player", positions: "CM", rating: 80, fatigue: 72, injury_games_remaining: 2, suspension_games_remaining: 0 };
  const player = buildSimulationPlayer(source);
  assert.equal(player.fatigue, 72);
  assert.equal(player.injuryGamesRemaining, 2);
  assert.equal(player.suspensionGamesRemaining, 0);
  assert.equal(source.fatigue, 72);
});

test("maps persisted settings and supplies balanced defaults", () => {
  assert.deepEqual(mapSimulationSettings(null), {
    overallInfluence: 60, tacticalInfluence: 25, homeAdvantage: 5, variance: 50,
    fogStrength: 40, fatigueEffect: 50, injuryFrequency: 50,
    disciplineFrequency: 50, goalEnvironment: 50,
  });
  assert.equal(mapSimulationSettings({ overall_influence: 72 }).overallInfluence, 72);
});
