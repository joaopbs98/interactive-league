import assert from "node:assert/strict";
import test from "node:test";

import { runCalibration } from "../lib/simulation/calibration.mjs";

test("full-season calibration is deterministic and reports football-level invariants", () => {
  const first = runCalibration({ seasons: 20, seed: "acceptance" });
  const second = runCalibration({ seasons: 20, seed: "acceptance" });
  assert.deepEqual(first, second);
  assert.equal(first.matches, 1120);
  assert.ok(first.goalsPerMatch > 2.2 && first.goalsPerMatch < 3.4);
  assert.ok(first.drawRate > 0.08 && first.drawRate < 0.45);
  assert.ok(first.homeWinRate > first.awayWinRate + 0.02);
  assert.ok(first.cardsPerMatch > 1.5 && first.cardsPerMatch < 5.5);
  assert.ok(first.ratingPointsCorrelation ** 2 > 0.45 && first.ratingPointsCorrelation ** 2 < 0.8);
  assert.equal(first.invariants.goalEventMismatch, 0);
  assert.equal(first.invariants.possessionMismatch, 0);
});
