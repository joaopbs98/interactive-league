import test from "node:test";
import assert from "node:assert/strict";
import { eligibleTicketPlayers, ticketRule } from "../lib/upgradeTicketRules.mjs";

test("ticket tiers retain their established boosts", () => {
  assert.equal(ticketRule("bronze").boost, 1);
  assert.equal(ticketRule("silver").boost, 2);
  assert.equal(ticketRule("gold").boost, 3);
  assert.equal(ticketRule("platinum").boost, 4);
});

test("an unknown tier safely uses the bronze rule", () => {
  assert.equal(ticketRule("unknown").label, "Bronze");
});

test("only previous-season roster players remain selectable", () => {
  const players = [{ player_id: "kept" }, { player_id: "new-signing" }];
  assert.deepEqual(eligibleTicketPlayers(players, ["kept"]), [{ player_id: "kept" }]);
});
