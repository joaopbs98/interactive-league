/**
 * Compute overall rating from position-weighted stats (EAFC-style)
 * OVR = round( sum(weight_i * stat_value_i) ) + international reputation boost
 *
 * FIFA/EAFC International Reputation formula (1-5 stars):
 * - 1-2 stars: no boost
 * - 3 stars: +1 if base OVR >= 51
 * - 4 stars: +1 if base 36-66, +2 if base 67-99
 * - 5 stars: +1 if base 24-49, +2 if base 50-74, +3 if base 75-99
 */

import {
  POSITION_WEIGHTS,
  resolvePrimaryPosition,
  type PositionKey,
} from "./youngsterAttributeWeights";

function parseIR(ir: string | number | null | undefined): number {
  if (ir == null) return 1;
  const n = typeof ir === "string" ? parseInt(ir, 10) : ir;
  return Math.min(5, Math.max(1, isNaN(n) ? 1 : n));
}

/**
 * FIFA/EAFC international reputation OVR boost based on base rating
 */
export function getInternationalReputationBoost(
  baseOvr: number,
  internationalReputation: string | number | null | undefined
): number {
  const ir = parseIR(internationalReputation);
  if (ir <= 2) return 0;
  if (ir === 3) return baseOvr >= 51 ? 1 : 0;
  if (ir === 4) return baseOvr >= 67 ? 2 : baseOvr >= 36 ? 1 : 0;
  // ir === 5
  return baseOvr >= 75 ? 3 : baseOvr >= 50 ? 2 : baseOvr >= 24 ? 1 : 0;
}

/**
 * Compute overall rating from positions string, individual stats, and international reputation.
 * Uses the primary position (first in comma-separated list) to look up weights.
 * Attributes not in the position's weights contribute 0.
 * Applies FIFA/EAFC international reputation boost to the base OVR.
 */
export function computeOverallFromStats(
  positions: string,
  stats: Record<string, number>,
  internationalReputation?: string | number | null
): number {
  const pos = resolvePrimaryPosition(positions) as PositionKey;
  const weights = POSITION_WEIGHTS[pos] ?? POSITION_WEIGHTS.CM;

  let sum = 0;
  for (const [attr, weight] of Object.entries(weights)) {
    const value = stats[attr];
    const statVal = typeof value === "number" && !isNaN(value) ? value : 50;
    sum += weight * statVal;
  }

  const baseOvr = Math.round(Math.min(99, Math.max(1, sum)));
  const irBoost = getInternationalReputationBoost(baseOvr, internationalReputation);
  return Math.min(99, Math.max(1, baseOvr + irBoost));
}
