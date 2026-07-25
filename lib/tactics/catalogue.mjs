export const TACTICS_ENGINE_VERSION = "fc25-il-1";

export const BUILD_UP_STYLES = ["short_passing", "balanced", "counter"];
export const DEFENSIVE_APPROACHES = {
  deep: { min: 1, max: 30, default: 25 },
  balanced: { min: 31, max: 60, default: 50 },
  high: { min: 61, max: 90, default: 70 },
  aggressive: { min: 91, max: 100, default: 95 },
};

export const VALID_FORMATIONS = [
  "3-1-4-2", "3-4-1-2", "3-4-2-1", "3-4-3", "3-5-1-1", "3-5-2",
  "4-1-2-1-2", "4-1-2-1-2 (2)", "4-1-2-1-2 Narrow", "4-1-2-1-2 Wide",
  "4-1-3-2", "4-1-4-1", "4-2-1-3", "4-2-2-2", "4-2-3-1", "4-2-3-1 (2)",
  "4-2-4", "4-3-1-2", "4-3-2-1", "4-3-3", "4-3-3 (2)", "4-3-3 (3)",
  "4-3-3 (4)", "4-3-3 (5)", "4-4-1-1", "4-4-1-1 (2)", "4-4-2",
  "4-4-2 (2)", "4-5-1", "5-1-2-2", "5-2-1-2", "5-2-3", "5-3-2", "5-4-1",
  "5-4-1 Diamond",
];

const role = (positions, name, focuses) => ({ positions, role: name, focuses });

export const ROLE_CATALOGUE = [
  role(["GK"], "goalkeeper", ["defend", "balanced"]),
  role(["GK"], "sweeper_keeper", ["balanced", "build_up"]),
  role(["LB", "RB"], "fullback", ["defend", "balanced"]),
  role(["LB", "RB"], "wingback", ["balanced", "support"]),
  role(["LB", "RB"], "falseback", ["defend", "balanced"]),
  role(["LB", "RB"], "attacking_wingback", ["balanced", "attack"]),
  role(["CB"], "defender", ["defend", "balanced"]),
  role(["CB"], "stopper", ["balanced", "aggressive"]),
  role(["CB"], "ball_playing_defender", ["defend", "build_up", "aggressive"]),
  role(["CDM"], "holding", ["defend", "roaming", "ball_winning"]),
  role(["CDM"], "centre_half", ["defend"]),
  role(["CDM"], "deep_lying_playmaker", ["defend", "roaming", "build_up"]),
  role(["CDM"], "wide_half", ["defend", "build_up"]),
  role(["CM"], "box_to_box", ["balanced"]),
  role(["CM"], "holding", ["defend", "ball_winning"]),
  role(["CM"], "deep_lying_playmaker", ["defend", "build_up"]),
  role(["CM"], "playmaker", ["attack", "roaming"]),
  role(["CM"], "half_winger", ["balanced", "attack"]),
  role(["LM", "RM"], "winger", ["balanced", "attack"]),
  role(["LM", "RM"], "wide_midfielder", ["defend", "balanced"]),
  role(["LM", "RM"], "wide_playmaker", ["attack", "build_up"]),
  role(["LM", "RM"], "inside_forward", ["balanced", "attack"]),
  role(["CAM"], "playmaker", ["balanced", "roaming", "build_up"]),
  role(["CAM"], "shadow_striker", ["attack"]),
  role(["CAM"], "half_winger", ["balanced", "attack"]),
  role(["CAM"], "classic_10", ["attack", "wide"]),
  role(["LW", "RW"], "winger", ["balanced", "attack"]),
  role(["LW", "RW"], "inside_forward", ["balanced", "attack", "roaming"]),
  role(["LW", "RW"], "wide_playmaker", ["attack", "build_up"]),
  role(["ST"], "advanced_forward", ["attack", "complete", "support"]),
  role(["ST"], "poacher", ["attack", "support"]),
  role(["ST"], "false_9", ["build_up"]),
  role(["ST"], "target_forward", ["balanced", "attack", "wide"]),
];

const POSITION_ALIASES = { LWB: "LB", RWB: "RB", CF: "ST" };

export function allowedRolesForPosition(position) {
  const normalized = POSITION_ALIASES[position] || position;
  return ROLE_CATALOGUE.filter((entry) => entry.positions.includes(normalized));
}

const DEFAULT_ASSIGNMENTS = {
  GK: ["goalkeeper", "defend"],
  LB: ["fullback", "defend"], RB: ["fullback", "defend"],
  CB: ["defender", "defend"],
  CDM: ["holding", "defend"],
  CM: ["box_to_box", "balanced"],
  CAM: ["playmaker", "balanced"],
  LM: ["wide_midfielder", "balanced"], RM: ["wide_midfielder", "balanced"],
  LW: ["winger", "balanced"], RW: ["winger", "balanced"],
  ST: ["advanced_forward", "complete"],
};

export function defaultAssignmentForPosition(position) {
  const normalized = POSITION_ALIASES[position] || position;
  const [role, focus] = DEFAULT_ASSIGNMENTS[normalized] || DEFAULT_ASSIGNMENTS.ST;
  return { role, focus };
}

export function validateTactic(tactic) {
  const errors = [];
  if (!VALID_FORMATIONS.includes(tactic?.formation)) {
    errors.push({ code: "INVALID_FORMATION", message: "Formation is not supported" });
  }
  if (!BUILD_UP_STYLES.includes(tactic?.buildUpStyle)) {
    errors.push({ code: "INVALID_BUILD_UP", message: "Build-up style is not supported" });
  }
  const approach = DEFENSIVE_APPROACHES[tactic?.defensiveApproach];
  if (!approach) {
    errors.push({ code: "INVALID_DEFENSIVE_APPROACH", message: "Defensive approach is not supported" });
  } else if (!Number.isInteger(tactic.lineHeight) || tactic.lineHeight < approach.min || tactic.lineHeight > approach.max) {
    errors.push({ code: "INVALID_LINE_HEIGHT", message: `Line height must be ${approach.min}-${approach.max}` });
  }
  if (!Array.isArray(tactic?.assignments) || tactic.assignments.length !== 11) {
    errors.push({ code: "INVALID_ASSIGNMENT_COUNT", message: "A tactic requires exactly 11 assignments" });
  } else {
    const playerIds = new Set();
    const slotIndexes = new Set();
    for (const assignment of tactic.assignments) {
      const allowed = allowedRolesForPosition(assignment.slotPosition);
      const selected = allowed.find((entry) => entry.role === assignment.role);
      if (!selected) errors.push({ code: "INVALID_ROLE", slotIndex: assignment.slotIndex, message: `${assignment.role} is not valid at ${assignment.slotPosition}` });
      else if (!selected.focuses.includes(assignment.focus)) errors.push({ code: "INVALID_FOCUS", slotIndex: assignment.slotIndex, message: `${assignment.focus} is not valid for ${assignment.role}` });
      if (slotIndexes.has(assignment.slotIndex)) errors.push({ code: "DUPLICATE_SLOT", slotIndex: assignment.slotIndex, message: "Slot is assigned more than once" });
      slotIndexes.add(assignment.slotIndex);
      if (playerIds.has(assignment.playerId)) errors.push({ code: "DUPLICATE_PLAYER", slotIndex: assignment.slotIndex, message: "Player is assigned more than once" });
      playerIds.add(assignment.playerId);
    }
  }
  return { valid: errors.length === 0, errors };
}
