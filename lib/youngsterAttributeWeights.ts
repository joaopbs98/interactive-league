/**
 * Position-weighted attribute weights for youngster upgrades (IL25 spec)
 * From Excel/Google Sheet - how each attribute contributes to OVR per position
 * https://docs.google.com/spreadsheets/d/1sfdtZPyceXVmi2oSgAT-da9fqmXBwdx4d7eVRDY8XRA
 */

export type PositionKey =
  | "GK"
  | "LB"
  | "RB"
  | "CB"
  | "LWB"
  | "RWB"
  | "CDM"
  | "LM"
  | "RM"
  | "CM"
  | "CAM"
  | "LW"
  | "RW"
  | "CF"
  | "ST";

/** Attribute key (league_players column) -> weight for position */
export type PositionWeights = Record<string, number>;

/** Weighted attributes per position (from images 1-2) */
export const POSITION_WEIGHTS: Record<PositionKey, PositionWeights> = {
  GK: {
    gk_diving: 0.21,
    gk_handling: 0.21,
    gk_reflexes: 0.21,
    gk_positioning: 0.21,
    reactions: 0.11,
    gk_kicking: 0.05,
  },
  LB: {
    sliding_tackle: 0.14,
    interceptions: 0.12,
    standing_tackle: 0.11,
    crossing: 0.09,
    stamina: 0.08,
    reactions: 0.08,
    defensive_awareness: 0.08,
    sprint_speed: 0.07,
    ball_control: 0.07,
    short_passing: 0.07,
    acceleration: 0.05,
    heading_accuracy: 0.04,
  },
  RB: {
    sliding_tackle: 0.14,
    interceptions: 0.12,
    standing_tackle: 0.11,
    crossing: 0.09,
    stamina: 0.08,
    reactions: 0.08,
    defensive_awareness: 0.08,
    sprint_speed: 0.07,
    ball_control: 0.07,
    short_passing: 0.07,
    acceleration: 0.05,
    heading_accuracy: 0.04,
  },
  CB: {
    standing_tackle: 0.17,
    defensive_awareness: 0.14,
    interceptions: 0.13,
    strength: 0.1,
    heading_accuracy: 0.1,
    sliding_tackle: 0.1,
    aggression: 0.07,
    reactions: 0.05,
    short_passing: 0.05,
    ball_control: 0.04,
    jumping: 0.03,
    sprint_speed: 0.02,
  },
  LWB: {
    interceptions: 0.12,
    crossing: 0.12,
    sliding_tackle: 0.11,
    stamina: 0.1,
    short_passing: 0.1,
    reactions: 0.08,
    ball_control: 0.08,
    standing_tackle: 0.08,
    defensive_awareness: 0.07,
    sprint_speed: 0.06,
    acceleration: 0.04,
    dribbling: 0.04,
  },
  RWB: {
    interceptions: 0.12,
    crossing: 0.12,
    sliding_tackle: 0.11,
    stamina: 0.1,
    short_passing: 0.1,
    reactions: 0.08,
    ball_control: 0.08,
    standing_tackle: 0.08,
    defensive_awareness: 0.07,
    sprint_speed: 0.06,
    acceleration: 0.04,
    dribbling: 0.04,
  },
  CDM: {
    interceptions: 0.14,
    short_passing: 0.14,
    standing_tackle: 0.12,
    ball_control: 0.1,
    long_passing: 0.1,
    defensive_awareness: 0.09,
    reactions: 0.07,
    stamina: 0.06,
    aggression: 0.05,
    sliding_tackle: 0.05,
    strength: 0.04,
    vision: 0.04,
  },
  LM: {
    dribbling: 0.15,
    ball_control: 0.13,
    short_passing: 0.11,
    crossing: 0.1,
    positioning: 0.08,
    acceleration: 0.07,
    reactions: 0.07,
    vision: 0.07,
    sprint_speed: 0.06,
    finishing: 0.06,
    stamina: 0.05,
    long_passing: 0.05,
  },
  RM: {
    dribbling: 0.15,
    ball_control: 0.13,
    short_passing: 0.11,
    crossing: 0.1,
    positioning: 0.08,
    acceleration: 0.07,
    reactions: 0.07,
    vision: 0.07,
    sprint_speed: 0.06,
    finishing: 0.06,
    stamina: 0.05,
    long_passing: 0.05,
  },
  CM: {
    short_passing: 0.17,
    ball_control: 0.14,
    vision: 0.13,
    long_passing: 0.13,
    reactions: 0.08,
    dribbling: 0.07,
    stamina: 0.06,
    positioning: 0.06,
    interceptions: 0.05,
    standing_tackle: 0.05,
    long_shots: 0.04,
    finishing: 0.02,
  },
  CAM: {
    short_passing: 0.16,
    ball_control: 0.15,
    vision: 0.14,
    dribbling: 0.13,
    positioning: 0.09,
    reactions: 0.07,
    finishing: 0.07,
    long_shots: 0.05,
    acceleration: 0.04,
    long_passing: 0.04,
    sprint_speed: 0.03,
    agility: 0.03,
  },
  LW: {
    dribbling: 0.16,
    ball_control: 0.14,
    finishing: 0.1,
    positioning: 0.09,
    crossing: 0.09,
    short_passing: 0.09,
    acceleration: 0.07,
    reactions: 0.07,
    sprint_speed: 0.06,
    vision: 0.06,
    long_shots: 0.04,
    agility: 0.03,
  },
  RW: {
    dribbling: 0.16,
    ball_control: 0.14,
    finishing: 0.1,
    positioning: 0.09,
    crossing: 0.09,
    short_passing: 0.09,
    acceleration: 0.07,
    reactions: 0.07,
    sprint_speed: 0.06,
    vision: 0.06,
    long_shots: 0.04,
    agility: 0.03,
  },
  CF: {
    ball_control: 0.15,
    dribbling: 0.14,
    positioning: 0.13,
    finishing: 0.11,
    reactions: 0.09,
    short_passing: 0.09,
    vision: 0.08,
    acceleration: 0.05,
    sprint_speed: 0.05,
    shot_power: 0.05,
    long_shots: 0.04,
    heading_accuracy: 0.02,
  },
  ST: {
    finishing: 0.18,
    positioning: 0.13,
    ball_control: 0.1,
    heading_accuracy: 0.1,
    shot_power: 0.1,
    reactions: 0.08,
    dribbling: 0.07,
    sprint_speed: 0.05,
    strength: 0.05,
    short_passing: 0.05,
    acceleration: 0.04,
    long_shots: 0.03,
    volleys: 0.02,
  },
};

/** Map positions string (e.g. "CB,CDM") to primary PositionKey */
export function resolvePrimaryPosition(positions: string): PositionKey {
  const first = (positions || "").split(/[,/]/)[0]?.trim().toUpperCase() || "CM";
  const map: Record<string, PositionKey> = {
    GK: "GK",
    LB: "LB",
    RB: "RB",
    CB: "CB",
    LWB: "LWB",
    RWB: "RWB",
    CDM: "CDM",
    LM: "LM",
    RM: "RM",
    CM: "CM",
    CAM: "CAM",
    LW: "LW",
    RW: "RW",
    CF: "CF",
    ST: "ST",
  };
  return map[first] ?? "CM";
}
