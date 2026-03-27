/**
 * Compute youngster attribute updates when applying OVR delta
 * Uses position weights + progression rates (1.6 default, 2.0 ind. training)
 */

import {
  POSITION_WEIGHTS,
  resolvePrimaryPosition,
  type PositionKey,
} from "./youngsterAttributeWeights";
import {
  PROGRESSION_RATE,
  IND_TRAINING_RATE,
  NON_WEIGHTED_RATE,
  getWeightedAttrsForPosition,
} from "./youngsterProgressionTables";

export type AttributeUpdates = Record<string, number>;

export interface ComputeYoungsterAttributesInput {
  baseOVR: number;
  newOVR: number;
  positions: string;
  currentAttributes: Record<string, number | null>;
  indTrainingAttrs: string[];
  nonWeightedAttrs: string[];
  potential?: number | null;
}

/**
 * Compute attribute values for a youngster after an OVR upgrade.
 * - Weighted attrs: progress at 1.6/OVR (2.0 if in ind_training)
 * - Non-weighted (the 6): progress at 1.0/OVR
 * - Capped by potential; all clamped 1-99
 */
export function computeYoungsterAttributes(
  input: ComputeYoungsterAttributesInput
): AttributeUpdates {
  const {
    baseOVR,
    newOVR,
    positions,
    currentAttributes,
    indTrainingAttrs,
    nonWeightedAttrs,
    potential,
  } = input;

  const ovrDelta = newOVR - baseOVR;
  const effectivePotential = potential ?? 99;
  const cappedOVR = Math.min(newOVR, effectivePotential);

  const pos = resolvePrimaryPosition(positions) as PositionKey;
  const weightedAttrs = getWeightedAttrsForPosition(pos);
  const indSet = new Set(indTrainingAttrs || []);
  const nonWeightedSet = new Set(nonWeightedAttrs || []);

  const result: AttributeUpdates = {};

  // Weighted attributes
  for (const attr of weightedAttrs) {
    const rate = indSet.has(attr) ? IND_TRAINING_RATE : PROGRESSION_RATE;
    const current = currentAttributes[attr] ?? 50;
    const delta = ovrDelta * rate;
    const newVal = Math.round(current + delta);
    result[attr] = clamp(newVal, 1, 99);
  }

  // Non-weighted attributes (the 6)
  for (const attr of nonWeightedSet) {
    if (result[attr] !== undefined) continue; // already set if also weighted
    const current = currentAttributes[attr] ?? 50;
    const delta = ovrDelta * NON_WEIGHTED_RATE;
    const newVal = Math.round(current + delta);
    result[attr] = clamp(newVal, 1, 99);
  }

  return result;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}
