const behavior = (attack, defence, width, endurance, length, buildUp, advance = 0, widen = 0, keyAttributes = []) => ({ attack, defence, width, endurance, length, buildUp, advance, widen, keyAttributes });

// Structural values are relative tendencies, not hidden player-rating boosts.
// They drive the visual shape, diagnostics, and engine involvement consistently.
export const ROLE_BEHAVIORS = {
  goalkeeper: behavior(5, 72, 35, 20, 48, 30, 0, 0, ["gk_positioning", "gk_reflexes"]),
  sweeper_keeper: behavior(10, 68, 42, 35, 62, 62, -5, 0, ["gk_positioning", "gk_kicking", "reactions"]),
  fullback: behavior(28, 78, 65, 55, 48, 45, -3, 6, ["stamina", "defensive_awareness", "crossing"]),
  wingback: behavior(55, 62, 82, 78, 65, 55, -11, 10, ["stamina", "crossing", "acceleration"]),
  falseback: behavior(32, 74, 28, 62, 45, 72, -4, -10, ["short_passing", "ball_control", "defensive_awareness"]),
  attacking_wingback: behavior(75, 42, 90, 90, 78, 58, -18, 12, ["stamina", "crossing", "sprint_speed"]),
  defender: behavior(12, 88, 38, 42, 38, 28, 2, 0, ["defensive_awareness", "standing_tackle", "strength"]),
  stopper: behavior(18, 84, 42, 68, 62, 25, -4, 0, ["aggression", "interceptions", "standing_tackle"]),
  ball_playing_defender: behavior(22, 78, 44, 52, 48, 74, -2, 0, ["long_passing", "composure", "defensive_awareness"]),
  holding: behavior(24, 82, 42, 62, 42, 52, 1, 0, ["interceptions", "defensive_awareness", "short_passing"]),
  centre_half: behavior(15, 86, 36, 55, 32, 45, 8, 0, ["defensive_awareness", "interceptions", "composure"]),
  deep_lying_playmaker: behavior(34, 68, 48, 58, 44, 88, 0, 0, ["vision", "long_passing", "composure"]),
  wide_half: behavior(30, 74, 75, 68, 52, 58, -2, 8, ["stamina", "short_passing", "defensive_awareness"]),
  box_to_box: behavior(62, 62, 55, 92, 76, 62, -7, 0, ["stamina", "short_passing", "positioning"]),
  playmaker: behavior(62, 35, 52, 65, 58, 94, -6, 0, ["vision", "short_passing", "ball_control"]),
  half_winger: behavior(64, 44, 76, 72, 66, 72, -8, 9, ["stamina", "ball_control", "short_passing"]),
  winger: behavior(72, 32, 94, 72, 78, 54, -11, 13, ["acceleration", "crossing", "dribbling"]),
  wide_midfielder: behavior(44, 62, 84, 72, 62, 55, -4, 10, ["stamina", "crossing", "defensive_awareness"]),
  wide_playmaker: behavior(64, 28, 82, 62, 66, 88, -7, 9, ["vision", "crossing", "ball_control"]),
  inside_forward: behavior(84, 26, 46, 72, 82, 54, -12, -10, ["finishing", "dribbling", "positioning"]),
  shadow_striker: behavior(92, 20, 42, 78, 90, 45, -15, 0, ["finishing", "positioning", "acceleration"]),
  classic_10: behavior(76, 15, 62, 48, 65, 90, -8, 4, ["vision", "ball_control", "short_passing"]),
  advanced_forward: behavior(90, 18, 48, 76, 92, 42, -10, 0, ["finishing", "positioning", "acceleration"]),
  poacher: behavior(98, 8, 34, 62, 95, 20, -13, 0, ["finishing", "positioning", "reactions"]),
  false_9: behavior(68, 20, 52, 62, 42, 92, 10, 0, ["vision", "short_passing", "ball_control"]),
  target_forward: behavior(84, 22, 52, 58, 82, 56, -5, 0, ["strength", "heading_accuracy", "finishing"]),
};

const FOCUS_MODIFIERS = {
  defend: { attack: -12, defence: 12, advance: 5 }, balanced: {}, attack: { attack: 12, defence: -8, advance: -6 },
  build_up: { buildUp: 14, attack: -3, advance: 4 }, roaming: { width: 6, endurance: 12, buildUp: 6 }, support: { buildUp: 7, defence: 4, advance: 2 },
  ball_winning: { defence: 11, endurance: 10, length: 7 }, aggressive: { defence: 7, endurance: 12, length: 12 },
  complete: { attack: 7, buildUp: 7, endurance: 6 }, wide: { width: 14, widen: 6 },
};
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const normalizeDiagnostic = (key, value) => {
  // Raw role occupation is structurally attack-low/defence-high because every XI
  // contains a goalkeeper and several defenders. Put both on the same neutral scale
  // so 50 means balanced tactical intent, not average player quality.
  if (key === "attack") return clamp(50 + (value - 36) * 2);
  if (key === "defence") return clamp(50 + (value - 69) * 2);
  return clamp(value);
};

export function deriveTacticDiagnostics({ assignments, buildUpStyle, defensiveApproach, lineHeight }) {
  const keys = ["attack", "defence", "width", "endurance", "length", "buildUp"];
  const totals = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const assignment of assignments) {
    const role = ROLE_BEHAVIORS[assignment.role] || behavior(50, 50, 50, 50, 50, 50);
    const focus = FOCUS_MODIFIERS[assignment.focus] || {};
    for (const key of keys) totals[key] += role[key] + (focus[key] || 0);
  }
  const count = Math.max(1, assignments.length);
  const style = buildUpStyle === "short_passing" ? { buildUp: 10, length: -8 } : buildUpStyle === "counter" ? { attack: 7, length: 12, buildUp: -4 } : {};
  const approach = defensiveApproach === "deep" ? { defence: 7, length: -10 } : defensiveApproach === "high" ? { defence: 4, endurance: 7, length: 8 } : defensiveApproach === "aggressive" ? { defence: 6, endurance: 14, length: 14 } : {};
  return Object.fromEntries(keys.map((key) => {
    const value = totals[key] / count + (style[key] || 0) + (approach[key] || 0) + (key === "length" ? (lineHeight - 50) * 0.2 : 0);
    return [key, Math.round(normalizeDiagnostic(key, value))];
  }));
}

export function deriveWithBallPositions(positions, assignments) {
  return positions.map((position, index) => {
    const assignment = assignments[index];
    const role = ROLE_BEHAVIORS[assignment?.role] || behavior(50, 50, 50, 50, 50, 50);
    const focus = FOCUS_MODIFIERS[assignment?.focus] || {};
    const direction = position.x < 50 ? -1 : position.x > 50 ? 1 : 0;
    return { ...position, x: clamp(position.x + direction * (role.widen + (focus.widen || 0)), 12, 88), y: clamp(position.y + role.advance + (focus.advance || 0), 12, 88) };
  });
}

const GROUPS = {
  GK: "GK", CB: "DEF", LB: "DEF", RB: "DEF", LWB: "DEF", RWB: "DEF",
  CDM: "MID", CM: "MID", CAM: "MID", LM: "WIDE", RM: "WIDE", LW: "WIDE", RW: "WIDE", ST: "ATT", CF: "ATT",
};
const camel = (value) => value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

export function roleFamiliarity(player, slotPosition, roleName) {
  const natural = String(player.positions || player.position || "").split(/[,/]/).map((value) => value.trim().toUpperCase());
  const slot = slotPosition === "LWB" ? "LB" : slotPosition === "RWB" ? "RB" : slotPosition === "CF" ? "ST" : slotPosition;
  const exact = natural.some((position) => (position === "LWB" ? "LB" : position === "RWB" ? "RB" : position === "CF" ? "ST" : position) === slot);
  const familiarGroup = natural.some((position) => GROUPS[position] && GROUPS[position] === GROUPS[slot]);
  const keys = ROLE_BEHAVIORS[roleName]?.keyAttributes || [];
  const fallback = Number(player.overall_rating ?? player.rating ?? 60);
  const availableKeys = keys.filter((key) => player[key] != null || player[camel(key)] != null);
  const profile = keys.length ? keys.reduce((sum, key) => sum + Number(player[key] ?? player[camel(key)] ?? fallback), 0) / keys.length : fallback;
  const roundedProfile = Math.round(profile);
  const positionFit = exact ? "natural" : familiarGroup ? "familiar" : "out_of_position";
  const goalkeeperMismatch = !exact && (slot === "GK" || (natural.includes("GK") && natural.every((position) => position === "GK")));
  const multiplier = goalkeeperMismatch
    ? 0
    : exact
    ? clamp(0.62 + profile * 0.004, 0.72, 1)
    : familiarGroup
      ? clamp(0.55 + profile * 0.004, 0.65, 0.93)
      : clamp(0.08 + profile * 0.004, 0.2, 0.45);
  const level = positionFit === "out_of_position"
    ? "out_of_position"
    : exact && profile >= 84
      ? "role_plus_plus"
      : (exact && profile >= 72) || (familiarGroup && profile >= 78)
        ? "role_plus"
        : "base_role";
  return {
    level,
    multiplier: Math.round(multiplier * 100) / 100,
    profile: roundedProfile,
    positionFit,
    profileSource: availableKeys.length === keys.length && keys.length > 0
      ? "attributes"
      : availableKeys.length > 0
        ? "mixed_fallback"
        : "overall_fallback",
  };
}
