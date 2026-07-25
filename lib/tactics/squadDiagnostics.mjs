import { ROLE_BEHAVIORS, roleFamiliarity } from "./diagnostics.mjs";

const clamp = (value) => Math.min(100, Math.max(0, Math.round(value)));
const camel = (value) => value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
const playerName = (player) => String(player.full_name || player.player_name || player.name || "Unknown player");

function attributeProfile(player, attributes) {
  const fallback = Number(player.overall_rating ?? player.rating ?? 60);
  let known = 0;
  const values = attributes.map((attribute) => {
    const value = player[attribute] ?? player[camel(attribute)];
    if (value != null && Number.isFinite(Number(value))) {
      known += 1;
      return Number(value);
    }
    return fallback;
  });
  return { score: values.reduce((sum, value) => sum + value, 0) / values.length, fallback: known < attributes.length };
}

const CATEGORIES = {
  scoring: {
    label: "Scoring",
    attributes: ["finishing", "positioning", "long_shots", "shot_power", "heading_accuracy"],
    relevant: (role, slot) => role.attack >= 60 || ["ST", "CF", "CAM", "LW", "RW"].includes(slot),
  },
  buildUp: {
    label: "Build-up quality",
    attributes: ["short_passing", "long_passing", "vision", "ball_control", "composure"],
    relevant: (role) => role.buildUp >= 45,
  },
  defending: {
    label: "Defending",
    attributes: ["defensive_awareness", "interceptions", "standing_tackle", "strength", "reactions"],
    relevant: (role, slot) => role.defence >= 50 || ["CB", "LB", "RB", "LWB", "RWB", "CDM"].includes(slot),
  },
  width: {
    label: "Wide threat",
    attributes: ["crossing", "dribbling", "acceleration", "sprint_speed", "ball_control"],
    relevant: (role, slot) => role.width >= 65 || ["LM", "RM", "LW", "RW", "LB", "RB", "LWB", "RWB"].includes(slot),
  },
};

function summarize(key, rows) {
  const sorted = [...rows].sort((a, b) => a.score - b.score);
  const score = clamp(rows.reduce((sum, row) => sum + row.score, 0) / Math.max(1, rows.length));
  return {
    key,
    label: CATEGORIES[key]?.label || key,
    score,
    status: score >= 72 ? "strength" : score < 58 ? "gap" : "mixed",
    weakest: sorted.slice(0, 2).map(({ playerId, name, score: value }) => ({ playerId, name, value: clamp(value) })),
    fallbackCount: rows.filter((row) => row.fallback).length,
    playerCount: rows.length,
  };
}

export function deriveSquadDiagnostics(players, assignments) {
  const categoryRows = Object.fromEntries(Object.keys(CATEGORIES).map((key) => [key, []]));
  const enduranceRows = [];
  const roleFitRows = [];

  players.slice(0, 11).forEach((player, index) => {
    if (!player || String(player.player_id || "").startsWith("empty-")) return;
    const assignment = assignments[index] || {};
    const role = ROLE_BEHAVIORS[assignment.role] || { attack: 50, defence: 50, width: 50, endurance: 50, buildUp: 50 };
    const slot = String(assignment.slotPosition || "").toUpperCase();
    const common = { playerId: player.player_id, name: playerName(player) };

    for (const [key, category] of Object.entries(CATEGORIES)) {
      if (!category.relevant(role, slot)) continue;
      const profile = attributeProfile(player, category.attributes);
      categoryRows[key].push({ ...common, score: profile.score, fallback: profile.fallback });
    }

    const stamina = attributeProfile(player, ["stamina"]);
    const workloadPenalty = Math.max(0, Number(role.endurance || 50) - 50) * 0.3;
    enduranceRows.push({ ...common, score: stamina.score - workloadPenalty, fallback: stamina.fallback });

    const familiarity = roleFamiliarity(player, slot, assignment.role);
    roleFitRows.push({ ...common, score: familiarity.multiplier * 100, fallback: familiarity.profileSource !== "attributes" });
  });

  return [
    summarize("scoring", categoryRows.scoring),
    summarize("buildUp", categoryRows.buildUp),
    summarize("defending", categoryRows.defending),
    summarize("width", categoryRows.width),
    { ...summarize("endurance", enduranceRows), label: "Endurance" },
    { ...summarize("roleFit", roleFitRows), label: "Role fit" },
  ];
}
