/**
 * Youngster attribute progression (IL25 spec)
 * Formula-based: attributes progress at 1.6 per OVR (2.0 for ind. training)
 * Full progression tables from Excel can be added later for accuracy
 */

import {
  POSITION_WEIGHTS,
  resolvePrimaryPosition,
  type PositionKey,
} from "./youngsterAttributeWeights";

/** Standard progression rate per OVR (non-ind-training) */
export const PROGRESSION_RATE = 1.6;

/** Ind. training progression rate (3 focuses) */
export const IND_TRAINING_RATE = 2.0;

/** Non-weighted attributes progression rate */
export const NON_WEIGHTED_RATE = 1.0;

/** All valid stat columns for attribute updates */
export const STAT_COLUMNS = [
  "acceleration",
  "sprint_speed",
  "agility",
  "reactions",
  "balance",
  "shot_power",
  "jumping",
  "stamina",
  "strength",
  "long_shots",
  "aggression",
  "interceptions",
  "positioning",
  "vision",
  "penalties",
  "composure",
  "crossing",
  "finishing",
  "heading_accuracy",
  "short_passing",
  "volleys",
  "dribbling",
  "curve",
  "fk_accuracy",
  "long_passing",
  "ball_control",
  "defensive_awareness",
  "standing_tackle",
  "sliding_tackle",
  "gk_diving",
  "gk_handling",
  "gk_kicking",
  "gk_positioning",
  "gk_reflexes",
] as const;

/** Get weighted attributes for a position */
export function getWeightedAttrsForPosition(position: PositionKey): string[] {
  return Object.keys(POSITION_WEIGHTS[position] || POSITION_WEIGHTS.CM);
}
