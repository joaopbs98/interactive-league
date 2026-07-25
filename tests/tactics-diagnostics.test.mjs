import assert from "node:assert/strict";
import test from "node:test";

import { ROLE_CATALOGUE } from "../lib/tactics/catalogue.mjs";
import { ROLE_BEHAVIORS, deriveTacticDiagnostics, deriveWithBallPositions, roleFamiliarity } from "../lib/tactics/diagnostics.mjs";

const assignments = [
  ["GK", "goalkeeper", "defend"], ["LB", "falseback", "balanced"], ["CB", "defender", "defend"], ["CB", "ball_playing_defender", "build_up"], ["RB", "attacking_wingback", "attack"],
  ["CDM", "holding", "defend"], ["CM", "box_to_box", "balanced"], ["CM", "playmaker", "roaming"], ["LW", "inside_forward", "attack"], ["RW", "winger", "attack"], ["ST", "false_9", "build_up"],
].map(([slotPosition, role, focus], slotIndex) => ({ slotIndex, slotPosition, playerId: `p${slotIndex}`, role, focus }));
const positions = assignments.map((assignment, index) => ({ label: assignment.slotPosition, x: index % 2 ? 25 : 75, y: index * 7 + 8 }));

test("every FC IQ role has declarative structural behavior", () => {
  for (const role of new Set(ROLE_CATALOGUE.map((entry) => entry.role))) {
    assert.ok(ROLE_BEHAVIORS[role], `missing behavior for ${role}`);
    for (const key of ["attack", "defence", "width", "endurance", "length", "buildUp"]) assert.ok(Number.isFinite(ROLE_BEHAVIORS[role][key]));
  }
});

test("diagnostics are bounded and with-ball geometry reflects role structure", () => {
  const diagnostics = deriveTacticDiagnostics({ assignments, buildUpStyle: "short_passing", defensiveApproach: "high", lineHeight: 75 });
  assert.deepEqual(Object.keys(diagnostics), ["attack", "defence", "width", "endurance", "length", "buildUp"]);
  assert.ok(Object.values(diagnostics).every((value) => value >= 0 && value <= 100));
  const shape = deriveWithBallPositions(positions, assignments);
  assert.equal(shape.length, 11);
  assert.ok(shape[1].x > positions[1].x, "left falseback should move toward the centre");
  assert.ok(shape[4].y < positions[4].y, "attacking wingback should advance");
});

test("balanced default roles normalize attack and defence onto comparable scales", () => {
  const assignments = [
    ["goalkeeper", "defend"], ["fullback", "defend"], ["defender", "defend"],
    ["defender", "defend"], ["fullback", "defend"], ["wide_midfielder", "balanced"],
    ["box_to_box", "balanced"], ["box_to_box", "balanced"], ["wide_midfielder", "balanced"],
    ["advanced_forward", "complete"], ["advanced_forward", "complete"],
  ].map(([role, focus]) => ({ role, focus }));
  const balanced = deriveTacticDiagnostics({ assignments, buildUpStyle: "balanced", defensiveApproach: "balanced", lineHeight: 50 });
  assert.ok(balanced.attack >= 40 && balanced.attack <= 60, `balanced attack should sit near neutral, got ${balanced.attack}`);
  assert.ok(balanced.defence >= 40 && balanced.defence <= 60, `balanced defence should sit near neutral, got ${balanced.defence}`);
});

test("familiarity rewards natural position and role attributes and penalizes unfamiliar slots", () => {
  const specialist = { positions: "ST,CF", overall_rating: 84, finishing: 90, positioning: 88, acceleration: 85 };
  const natural = roleFamiliarity(specialist, "ST", "poacher");
  const unfamiliar = roleFamiliarity(specialist, "CB", "defender");
  assert.equal(natural.level, "role_plus_plus");
  assert.equal(natural.positionFit, "natural");
  assert.equal(natural.profileSource, "mixed_fallback");
  assert.equal(unfamiliar.level, "out_of_position");
  assert.ok(natural.multiplier > unfamiliar.multiplier);
});

test("execution varies continuously by role profile instead of collapsing valid players to 87%", () => {
  const goalkeeper = roleFamiliarity({ positions: "GK", overall_rating: 60 }, "GK", "goalkeeper");
  const centreBack = roleFamiliarity({ positions: "CB", overall_rating: 55 }, "CB", "defender");
  assert.equal(goalkeeper.profileSource, "overall_fallback");
  assert.equal(goalkeeper.positionFit, "natural");
  assert.notEqual(goalkeeper.multiplier, centreBack.multiplier);
  assert.equal(goalkeeper.multiplier, 0.86);
  assert.equal(centreBack.multiplier, 0.84);
});

test("goalkeeper and outfield slots are incompatible while adjacent positions remain usable", () => {
  const goalkeeperAtCentreBack = roleFamiliarity({ positions: "GK", overall_rating: 90 }, "CB", "defender");
  const centreBackInGoal = roleFamiliarity({ positions: "CB", overall_rating: 90 }, "GK", "goalkeeper");
  const wingerAtWideMid = roleFamiliarity({ positions: "LW", overall_rating: 80 }, "LM", "wide_midfielder");
  const strikerAtCentreBack = roleFamiliarity({ positions: "ST", overall_rating: 90 }, "CB", "defender");
  assert.equal(goalkeeperAtCentreBack.multiplier, 0);
  assert.equal(centreBackInGoal.multiplier, 0);
  assert.equal(wingerAtWideMid.positionFit, "familiar");
  assert.ok(wingerAtWideMid.multiplier >= 0.65);
  assert.ok(strikerAtCentreBack.multiplier <= 0.45);
});
