import test from "node:test";
import assert from "node:assert/strict";
import { deriveSquadDiagnostics } from "../lib/tactics/squadDiagnostics.mjs";

const assignment = (slotPosition, role) => ({ slotPosition, role, focus: "balanced" });

test("squad diagnostics use player attributes and identify the weakest contributor", () => {
  const players = [
    { player_id: "st1", name: "Finisher", positions: "ST", overall_rating: 80, finishing: 90, positioning: 88, long_shots: 82, shot_power: 85, heading_accuracy: 80, stamina: 80 },
    { player_id: "st2", name: "Weak finisher", positions: "ST", overall_rating: 75, finishing: 45, positioning: 50, long_shots: 48, shot_power: 52, heading_accuracy: 44, stamina: 60 },
  ];
  const result = deriveSquadDiagnostics(players, [assignment("ST", "advanced_forward"), assignment("ST", "poacher")]);
  const scoring = result.find((item) => item.key === "scoring");
  assert.equal(scoring.weakest[0].name, "Weak finisher");
  assert.ok(scoring.score > 55 && scoring.score < 80);
});

test("endurance accounts for stamina and role workload", () => {
  const tiredWingback = { player_id: "wb", name: "Tired wingback", positions: "LB", overall_rating: 80, stamina: 55 };
  const holdingDefender = { player_id: "cb", name: "Fresh defender", positions: "CB", overall_rating: 75, stamina: 75 };
  const result = deriveSquadDiagnostics([tiredWingback, holdingDefender], [assignment("LB", "attacking_wingback"), assignment("CB", "defender")]);
  const endurance = result.find((item) => item.key === "endurance");
  assert.equal(endurance.weakest[0].name, "Tired wingback");
  assert.ok(endurance.weakest[0].value < 50);
});

test("role fit exposes goalkeeper-outfield incompatibility", () => {
  const winger = { player_id: "lw", name: "Winger in goal", positions: "LW", overall_rating: 85 };
  const result = deriveSquadDiagnostics([winger], [assignment("GK", "goalkeeper")]);
  const roleFit = result.find((item) => item.key === "roleFit");
  assert.equal(roleFit.score, 0);
  assert.equal(roleFit.status, "gap");
});
