import assert from "node:assert/strict";
import test from "node:test";

import { applySimulationPreset, validateSimulationSettings } from "../lib/simulation/settings.mjs";

test("simulation presets are complete, bounded, and distinct", () => {
  const balanced = applySimulationPreset("balanced");
  const ratingHeavy = applySimulationPreset("rating_heavy");
  const tactical = applySimulationPreset("tactical");
  for (const value of [balanced, ratingHeavy, tactical]) assert.deepEqual(validateSimulationSettings(value), []);
  assert.ok(ratingHeavy.overallInfluence > balanced.overallInfluence);
  assert.ok(tactical.tacticalInfluence > balanced.tacticalInfluence);
});

test("custom settings reject fake or unsafe calibration values", () => {
  const errors = validateSimulationSettings({ ...applySimulationPreset("balanced"), overallInfluence: 90, tacticalInfluence: 40, previewRerolls: 9 });
  assert.ok(errors.some((error) => error.includes("overallInfluence")));
  assert.ok(errors.some((error) => error.includes("combined")));
  assert.ok(errors.some((error) => error.includes("previewRerolls")));
});
