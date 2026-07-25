import test from "node:test";
import assert from "node:assert/strict";
import { isPlayerVisibleInLeague, visiblePlayerScope } from "../lib/playerScopeRules.mjs";

test("master catalogue players are visible in every save", () => {
  assert.equal(isPlayerVisibleInLeague(null, "league-b"), true);
});

test("custom players are visible only in their source save", () => {
  assert.equal(isPlayerVisibleInLeague("league-a", "league-a"), true);
  assert.equal(isPlayerVisibleInLeague("league-a", "league-b"), false);
});

test("Supabase scope includes master rows and the current save only", () => {
  assert.equal(visiblePlayerScope("league-a"), "source_league_id.is.null,source_league_id.eq.league-a");
});
