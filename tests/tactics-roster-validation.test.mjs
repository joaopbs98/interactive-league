import assert from "node:assert/strict";
import test from "node:test";

import { validateRosterSelection } from "../lib/tactics/rosterValidation.mjs";

const rows = Array.from({ length: 18 }, (_, index) => ({
  player_id: `p${index}`, player_name: `Player ${index}`, injury_games_remaining: 0, suspension_games_remaining: 0,
}));

test("accepts a unique, owned, available XI and bench", () => {
  assert.deepEqual(validateRosterSelection({ starting: rows.slice(0, 11).map((p) => p.player_id), bench: rows.slice(11).map((p) => p.player_id), reserves: [], ownedPlayers: rows }), []);
});

test("rejects unavailable starters, duplicates, incomplete XIs, and foreign players", () => {
  const injured = rows.map((row) => row.player_id === "p0" ? { ...row, injury_games_remaining: 2 } : row);
  const errors = validateRosterSelection({ starting: ["p0", ...rows.slice(1, 10).map((p) => p.player_id), "foreign"], bench: ["p1"], reserves: [], ownedPlayers: injured });
  assert.ok(errors.some((error) => error.includes("11")) === false, "input still contains eleven slots");
  assert.ok(errors.some((error) => error.includes("Player 0") && error.includes("injured")));
  assert.ok(errors.some((error) => error.includes("foreign")));
  assert.ok(errors.some((error) => error.includes("more than once")));
  assert.ok(validateRosterSelection({ starting: ["p0"], bench: [], reserves: [], ownedPlayers: rows }).some((error) => error.includes("11")));
});
