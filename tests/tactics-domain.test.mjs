import test from "node:test";
import assert from "node:assert/strict";

import {
  TACTICS_ENGINE_VERSION,
  ROLE_CATALOGUE,
  allowedRolesForPosition,
  defaultAssignmentForPosition,
  validateTactic,
} from "../lib/tactics/catalogue.mjs";

test("catalogue contains every documented FC 25 role", () => {
  assert.equal(TACTICS_ENGINE_VERSION, "fc25-il-1");
  assert.equal(ROLE_CATALOGUE.length, 33);
  assert.deepEqual(
    allowedRolesForPosition("GK").map((entry) => entry.role),
    ["goalkeeper", "sweeper_keeper"],
  );
  assert.deepEqual(
    allowedRolesForPosition("ST").map((entry) => entry.role),
    ["advanced_forward", "poacher", "false_9", "target_forward"],
  );
});

test("provides a valid conservative default for every FC IQ slot", () => {
  for (const position of ["GK", "LB", "RB", "CB", "CDM", "CM", "LM", "RM", "CAM", "LW", "RW", "ST", "CF", "LWB", "RWB"]) {
    const assignment = defaultAssignmentForPosition(position);
    const definition = allowedRolesForPosition(position).find((entry) => entry.role === assignment.role);
    assert.ok(definition, `missing default role for ${position}`);
    assert.ok(definition.focuses.includes(assignment.focus), `invalid default focus for ${position}`);
  }
});

test("legacy wingback and centre-forward slots map to FC IQ positions", () => {
  assert.deepEqual(allowedRolesForPosition("LWB"), allowedRolesForPosition("LB"));
  assert.deepEqual(allowedRolesForPosition("RWB"), allowedRolesForPosition("RB"));
  assert.deepEqual(allowedRolesForPosition("CF"), allowedRolesForPosition("ST"));
});

test("validates role and focus compatibility for every lineup slot", () => {
  const assignments = [
    ["GK", "sweeper_keeper", "build_up"],
    ["LB", "falseback", "balanced"],
    ["CB", "defender", "defend"],
    ["CB", "ball_playing_defender", "build_up"],
    ["RB", "attacking_wingback", "attack"],
    ["CDM", "holding", "defend"],
    ["CM", "box_to_box", "balanced"],
    ["CM", "playmaker", "roaming"],
    ["LW", "inside_forward", "attack"],
    ["RW", "winger", "attack"],
    ["ST", "advanced_forward", "complete"],
  ].map(([slotPosition, role, focus], slotIndex) => ({ slotIndex, slotPosition, role, focus, playerId: `p${slotIndex}` }));

  assert.deepEqual(validateTactic({
    formation: "4-3-3",
    buildUpStyle: "balanced",
    defensiveApproach: "high",
    lineHeight: 70,
    assignments,
  }), { valid: true, errors: [] });
});

test("rejects incompatible roles, focuses, duplicate players, and invalid line height", () => {
  const assignments = Array.from({ length: 11 }, (_, slotIndex) => ({
    slotIndex,
    slotPosition: slotIndex === 0 ? "GK" : "ST",
    role: slotIndex === 0 ? "goalkeeper" : "poacher",
    focus: slotIndex === 0 ? "defend" : "attack",
    playerId: slotIndex === 10 ? "p9" : `p${slotIndex}`,
  }));
  assignments[1] = { ...assignments[1], role: "falseback", focus: "attack" };

  const result = validateTactic({
    formation: "invalid",
    buildUpStyle: "counter",
    defensiveApproach: "deep",
    lineHeight: 70,
    assignments,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === "INVALID_FORMATION"));
  assert.ok(result.errors.some((error) => error.code === "INVALID_LINE_HEIGHT"));
  assert.ok(result.errors.some((error) => error.code === "INVALID_ROLE"));
  assert.ok(result.errors.some((error) => error.code === "DUPLICATE_PLAYER"));
});
