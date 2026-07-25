import { roleFamiliarity } from "../tactics/diagnostics.mjs";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, places = 2) => Number(value.toFixed(places));

function seededRandom(seed) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += 0x6d2b79f5;
    let value = hash;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const attr = (player, name) => clamp(Number(player[name] ?? player.rating ?? 60), 1, 99);
const average = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

function teamProfile(team) {
  const outfield = team.players.filter((player) => (assignmentFor(team, player).slotPosition || player.position) !== "GK");
  const keeper = team.players.find((player) => (assignmentFor(team, player).slotPosition || player.position) === "GK") || team.players[0];
  const overall = average(team.players.map((player) => player.rating));
  const effective = (player, name) => attr(player, name) * roleFamiliarity(player, assignmentFor(team, player).slotPosition || player.position, assignmentFor(team, player).role).multiplier;
  return {
    overall,
    buildup: average(outfield.map((player) => average([effective(player, "shortPassing"), effective(player, "ballControl"), effective(player, "composure")]))),
    creation: average(outfield.map((player) => average([effective(player, "vision"), effective(player, "positioning"), effective(player, "longPassing")]))),
    transition: average(outfield.map((player) => average([effective(player, "acceleration"), effective(player, "sprintSpeed"), effective(player, "positioning")]))),
    defence: average(outfield.map((player) => average([effective(player, "defensiveAwareness"), effective(player, "interceptions"), effective(player, "standingTackle")]))),
    stamina: average(outfield.map((player) => effective(player, "stamina"))),
    fatigue: average(team.players.map((player) => clamp(Number(player.fatigue ?? 0), 0, 100))),
    goalkeeper: average([effective(keeper, "gkDiving"), effective(keeper, "gkHandling"), effective(keeper, "gkPositioning"), effective(keeper, "gkReflexes")]),
  };
}

function formationShape(team) {
  const positions = team.tactic.assignments.map((assignment) => assignment.slotPosition);
  const count = (wanted) => positions.filter((position) => wanted.includes(position)).length;
  return {
    attackingPresence: count(["ST", "CF"]) + count(["LW", "RW"]) * 0.8
      + count(["CAM"]) * 0.55 + count(["LM", "RM"]) * 0.35 + count(["LWB", "RWB"]) * 0.2,
    midfieldControl: count(["CM", "CDM"]) + count(["CAM"]) * 0.8
      + count(["LM", "RM"]) * 0.55 + count(["LW", "RW"]) * 0.25 + count(["LWB", "RWB"]) * 0.2,
    defensiveCoverage: count(["CB"]) + count(["LB", "RB"]) * 0.75
      + count(["LWB", "RWB"]) * 0.55 + count(["CDM"]) * 0.65 + count(["CM"]) * 0.18,
    width: count(["LW", "RW", "LM", "RM"]) + count(["LWB", "RWB"]) * 0.8,
  };
}

const roleAttackWeight = {
  poacher: 1.65, advanced_forward: 1.5, shadow_striker: 1.4, inside_forward: 1.3,
  target_forward: 1.25, false_9: 1.05, winger: 0.95, attacking_wingback: 0.75,
  box_to_box: 0.7, playmaker: 0.65, half_winger: 0.7, wide_playmaker: 0.65,
  wingback: 0.5, wide_midfielder: 0.45, fullback: 0.25, holding: 0.25,
  deep_lying_playmaker: 0.25, stopper: 0.18, ball_playing_defender: 0.16,
  defender: 0.12, centre_half: 0.1, goalkeeper: 0.02, sweeper_keeper: 0.02,
};

function assignmentFor(team, player) {
  return team.tactic.assignments.find((assignment) => assignment.playerId === player.playerId) || { role: "advanced_forward", focus: "balanced" };
}

function chooseWeighted(items, weightFor, random) {
  const weights = items.map((item) => Math.max(0.001, weightFor(item)));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let target = random() * total;
  for (let index = 0; index < items.length; index += 1) {
    target -= weights[index];
    if (target <= 0) return items[index];
  }
  return items.at(-1);
}

function chooseScorer(team, shotType, random) {
  return chooseWeighted(team.players.filter((player) => (assignmentFor(team, player).slotPosition || player.position) !== "GK"), (player) => {
    const assignment = assignmentFor(team, player);
    const role = roleAttackWeight[assignment.role] || 0.4;
    const focus = assignment.focus === "attack" ? 1.18 : assignment.focus === "defend" ? 0.75 : 1;
    const coefficients = shotType === "header"
      ? attr(player, "headingAccuracy") * 2.2 + attr(player, "finishing")
      : shotType === "long_shot"
        ? attr(player, "longShots") * 2 + attr(player, "finishing")
        : attr(player, "finishing") * 6.6 + attr(player, "longShots") * 0.9 + attr(player, "headingAccuracy") * 0.5 - attr(player, "interceptions");
    const execution = roleFamiliarity(player, assignment.slotPosition || player.position, assignment.role).multiplier;
    return Math.max(1, coefficients) * role * focus * execution;
  }, random);
}

function chooseAssister(team, scorer, shotType, random) {
  if (random() < 0.18) return null;
  const candidates = team.players.filter((player) => player.playerId !== scorer.playerId && player.position !== "GK");
  return chooseWeighted(candidates, (player) => {
    const assignment = assignmentFor(team, player);
    const creativity = average([attr(player, "vision"), attr(player, "shortPassing"), attr(player, "longPassing"), shotType === "header" ? attr(player, "crossing") : attr(player, "ballControl")]);
    const role = ["playmaker", "wide_playmaker", "deep_lying_playmaker", "false_9"].includes(assignment.role) ? 1.45 : 1;
    const execution = roleFamiliarity(player, assignment.slotPosition || player.position, assignment.role).multiplier;
    return creativity * role * execution;
  }, random);
}

function passInvolvementWeight(team, player, phase) {
  const assignment = assignmentFor(team, player);
  const position = assignment.slotPosition || player.position;
  const baseByPosition = {
    GK: 0.38,
    CB: 1.25, LB: 1.02, RB: 1.02, LWB: 1.08, RWB: 1.08,
    CDM: 1.48, CM: 1.62, CAM: 1.25, LM: 1.02, RM: 1.02,
    LW: 0.78, RW: 0.78, CF: 0.76, ST: 0.62,
  };
  const group = position === "GK" ? "GK"
    : ["CB", "LB", "RB", "LWB", "RWB"].includes(position) ? "DEF"
      : ["CDM", "CM", "CAM", "LM", "RM"].includes(position) ? "MID" : "ATT";
  const phaseWeight = {
    buildup: { GK: 1.65, DEF: 1.35, MID: 1.05, ATT: 0.45 },
    progression: { GK: 0.35, DEF: 1.0, MID: 1.45, ATT: 0.82 },
    transition: { GK: 0.15, DEF: 0.58, MID: 1.08, ATT: 1.38 },
    chance_creation: { GK: 0.1, DEF: 0.48, MID: 1.18, ATT: 1.3 },
  }[phase] || { GK: 0.4, DEF: 1, MID: 1.2, ATT: 0.9 };
  const roleWeight = ["playmaker", "wide_playmaker", "deep_lying_playmaker", "false_9", "ball_playing_defender"].includes(assignment.role) ? 1.22 : 1;
  const styleWeight = team.tactic.buildUpStyle === "short_passing"
    ? (group === "MID" ? 1.18 : group === "ATT" ? 0.9 : 1.05)
    : team.tactic.buildUpStyle === "counter"
      ? (group === "ATT" ? 1.22 : group === "GK" ? 0.82 : 0.94)
      : 1;
  const focusWeight = assignment.focus === "roaming" ? 1.08 : assignment.focus === "defend" && group === "ATT" ? 0.88 : 1;
  const execution = roleFamiliarity(player, position, assignment.role).multiplier;
  return (baseByPosition[position] || 1) * phaseWeight[group] * roleWeight * styleWeight * focusWeight * Math.max(0.08, execution);
}

function individualPassSuccess(team, opponent, player, phase) {
  const assignment = assignmentFor(team, player);
  const position = assignment.slotPosition || player.position;
  const phaseAdjustment = phase === "buildup" ? 0.07 : phase === "transition" ? -0.06 : phase === "chance_creation" ? -0.09 : 0;
  const positionAdjustment = position === "GK" ? 0.02
    : ["CB", "LB", "RB"].includes(position) ? 0.035
      : ["LW", "RW", "CF", "ST"].includes(position) ? -0.045 : 0;
  const styleAdjustment = team.tactic.buildUpStyle === "short_passing" ? 0.035 : team.tactic.buildUpStyle === "counter" ? -0.025 : 0;
  const pressureAdjustment = opponent.tactic.defensiveApproach === "aggressive" ? -0.035
    : opponent.tactic.defensiveApproach === "high" ? -0.02 : opponent.tactic.defensiveApproach === "deep" ? 0.015 : 0;
  const baseChance =
    0.48 + attr(player, "shortPassing") * 0.0026 + attr(player, "composure") * 0.001
      + phaseAdjustment + positionAdjustment + styleAdjustment + pressureAdjustment;
  const execution = roleFamiliarity(player, position, assignment.role).multiplier;
  return clamp(baseChance * (execution === 0 ? 0.42 : 0.72 + execution * 0.28), 0.18, 0.96);
}

function defensiveActionWeight(team, player, phase, action) {
  const position = assignmentFor(team, player).slotPosition || player.position;
  const group = position === "GK" ? "GK"
    : ["CB", "LB", "RB", "LWB", "RWB"].includes(position) ? "DEF"
      : ["CDM", "CM", "CAM", "LM", "RM"].includes(position) ? "MID" : "ATT";
  const weights = {
    interception: { GK: 0.01, DEF: 1.55, MID: 0.9, ATT: 0.18 },
    recovery: { GK: 0.05, DEF: 1.35, MID: 1, ATT: 0.28 },
    pressure: { GK: 0.01, DEF: 0.95, MID: 1.15, ATT: 0.62 },
    tackle: { GK: 0.01, DEF: 1.35, MID: 1, ATT: 0.34 },
    block: { GK: 0.01, DEF: 1.7, MID: 0.65, ATT: 0.1 },
    aerial: { GK: 0.01, DEF: 1.65, MID: 0.65, ATT: 0.28 },
    foul: { GK: 0.01, DEF: 1.2, MID: 1, ATT: 0.48 },
  };
  let weight = weights[action]?.[group] ?? 1;
  if (position === "CDM") weight *= 1.35;
  if (position === "CB" && ["block", "aerial", "interception"].includes(action)) weight *= 1.2;
  if (phase === "buildup" && action === "pressure" && group === "ATT") weight *= 1.45;
  if (phase === "transition" && group === "DEF" && ["interception", "tackle", "block"].includes(action)) weight *= 1.15;
  const assignment = assignmentFor(team, player);
  const execution = roleFamiliarity(player, position, assignment.role).multiplier;
  return weight * Math.max(0.04, execution);
}

function tacticalAttackMultiplier(attacking, defending) {
  let multiplier = 1;
  if (attacking.tactic.buildUpStyle === "counter") {
    if (["high", "aggressive"].includes(defending.tactic.defensiveApproach)) multiplier += 0.2;
    if (defending.tactic.defensiveApproach === "deep") multiplier -= 0.08;
  }
  if (attacking.tactic.buildUpStyle === "short_passing" && defending.tactic.defensiveApproach === "deep") multiplier += 0.05;
  if (defending.tactic.defensiveApproach === "aggressive") multiplier += 0.04;
  return multiplier;
}

function emptyTeamStats() {
  return {
    possession: 0, fieldTilt: 0, shots: 0, shotsOnTarget: 0, xg: 0, xgot: 0,
    bigChances: 0, bigChancesMissed: 0, passes: 0, completedPasses: 0, progressivePasses: 0,
    keyPasses: 0, crosses: 0, completedCrosses: 0, carries: 0, progressiveCarries: 0,
    dribbles: 0, successfulDribbles: 0, pressures: 0, tackles: 0, interceptions: 0,
    recoveries: 0, blocks: 0, clearances: 0, duels: 0, duelsWon: 0, aerialDuels: 0,
    aerialDuelsWon: 0, corners: 0, fouls: 0, yellowCards: 0, redCards: 0,
    offsides: 0, saves: 0, goalsPrevented: 0, longBalls: 0, completedLongBalls: 0,
    passesOwnThird: 0, passesMiddleThird: 0, passesFinalThird: 0,
  };
}

const POSITION_COORDS = {
  GK: [8, 50], LB: [25, 18], LWB: [34, 16], CB: [24, 50], RB: [25, 82], RWB: [34, 84],
  CDM: [40, 50], LM: [53, 18], CM: [53, 50], RM: [53, 82], CAM: [66, 50],
  LW: [72, 18], CF: [77, 50], ST: [82, 50], RW: [72, 82],
};

function heatmapFromPositions(positions) {
  const bins = Array.from({ length: 24 }, () => 0);
  for (const { x, y } of positions) {
    const column = Math.min(5, Math.floor(x / (100 / 6)));
    const row = Math.min(3, Math.floor(y / 25));
    bins[row * 6 + column] += 1;
  }
  const max = Math.max(...bins, 1);
  return bins.map((value) => round(value / max, 3));
}

function assignmentCoordinate(team, player, assignment = assignmentFor(team, player)) {
  const position = assignment?.slotPosition || player.position;
  const [baseX, baseY] = POSITION_COORDS[position] || POSITION_COORDS.CM;
  const peers = (team.tactic.assignments || []).filter((candidate) => candidate.slotPosition === position).sort((a, b) => a.slotIndex - b.slotIndex);
  const peerIndex = Math.max(0, peers.findIndex((candidate) => candidate.playerId === player.playerId));
  const offset = peers.length > 1 ? (peerIndex - (peers.length - 1) / 2) * Math.min(24, 54 / peers.length) : 0;
  return [baseX, clamp(baseY + offset, 10, 90)];
}

function trackingPosition(player, assignment, side, phase, random, team, inPossession) {
  const [baseX, baseY] = assignmentCoordinate(team, player, assignment);
  const position = assignment?.slotPosition || player.position;
  const isGoalkeeper = position === "GK";
  const phaseShift = phase === "chance_creation" ? 10 : phase === "transition" ? 7 : phase === "buildup" ? -4 : 2;
  const lineShift = isGoalkeeper ? (Number(team.tactic.lineHeight || 50) - 50) * 0.06 : (Number(team.tactic.lineHeight || 50) - 50) * 0.18;
  const focusShift = assignment?.focus === "attack" ? 4 : assignment?.focus === "defend" ? -3 : 0;
  const counterShift = team.tactic.buildUpStyle === "counter" && phase === "transition" ? 6 : 0;
  const defensiveApproachShift = team.tactic.defensiveApproach === "deep" ? -4 : team.tactic.defensiveApproach === "aggressive" ? 3 : 0;
  const xShift = inPossession ? phaseShift + focusShift + counterShift + lineShift * 0.35 : lineShift + defensiveApproachShift;
  const compactness = !inPossession && team.tactic.defensiveApproach === "deep" ? 0.78 : 1;
  const spreadY = isGoalkeeper ? 2.5 : assignment?.focus === "roaming" ? 13 : 8;
  const tacticalY = 50 + (baseY - 50) * compactness;
  const x = clamp(baseX + xShift + (random() - 0.5) * (isGoalkeeper ? 3 : 8), 1, 99);
  const y = clamp(tacticalY + (random() - 0.5) * spreadY, 1, 99);
  return { playerId: player.playerId, x: round(side === "home" ? x : 100 - x, 1), y: round(y, 1) };
}

export function simulateMatch({ matchId, seed, home, away, settings }) {
  const random = seededRandom(`${seed}:${matchId}:fc25-il-2`);
  const statRandom = seededRandom(`${seed}:${matchId}:fc25-il-2:player-stats`);
  const trackingRandom = seededRandom(`${seed}:${matchId}:fc25-il-2:tracking`);
  const profiles = { home: teamProfile(home), away: teamProfile(away) };
  const shapes = { home: formationShape(home), away: formationShape(away) };
  const teams = { home, away };
  const stats = { home: emptyTeamStats(), away: emptyTeamStats() };
  const events = [];
  const trackingFrames = [];
  const allPlayers = [...home.players, ...home.bench, ...away.players, ...away.bench];
  const homeIds = new Set([...home.players, ...home.bench].map((player) => player.playerId));
  const starterIds = new Set([...home.players, ...away.players].map((player) => player.playerId));
  const playerLines = new Map(allPlayers.map((player) => {
    const team = homeIds.has(player.playerId) ? home : away;
    const starter = starterIds.has(player.playerId);
    const assignment = starter ? assignmentFor(team, player) : {};
    return [player.playerId, {
      playerId: player.playerId, teamId: team.id, starter, slotPosition: assignment.slotPosition || player.position, role: assignment.role || null, focus: assignment.focus || null,
      minutes: starter ? 90 : 0, rating: 6, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0,
      keyPasses: 0, passes: 0, completedPasses: 0, tackles: 0, interceptions: 0, saves: 0,
      xg: 0, xgot: 0, xa: 0, bigChances: 0, bigChancesMissed: 0, progressivePasses: 0,
      crosses: 0, completedCrosses: 0, touches: 0, carries: 0, progressiveCarries: 0,
      dribbles: 0, successfulDribbles: 0, dispossessed: 0, pressures: 0, recoveries: 0,
      blocks: 0, clearances: 0, duels: 0, duelsWon: 0, aerialDuels: 0, aerialDuelsWon: 0,
      errorsLeadingToShot: 0, errorsLeadingToGoal: 0, goalsPrevented: 0,
      shotsFaced: 0, goalsConceded: 0,
      offsides: 0, fouled: 0, longBalls: 0, completedLongBalls: 0,
      passesOwnThird: 0, passesMiddleThird: 0, passesFinalThird: 0,
      claims: 0, successfulClaims: 0, punches: 0, sweeperActions: 0,
      fouls: 0, yellowCards: 0, redCards: 0, fatigueDelta: 0,
      distanceKm: 0, highSpeedDistanceKm: 0, sprintDistanceKm: 0, maxSpeedKmh: 0, sprintCount: 0,
      heatmap: [], shotMap: [], passMap: [], averagePosition: null, ratingComponents: null,
    }];
  }));

  // Match form is zero-mean: variance widens outcomes without buffing either
  // side. FOG adds a larger symmetric swing only when the OVR gap is meaningful.
  const varianceScale = clamp(settings.variance, 20, 80) / 80;
  const varianceSwing = (random() - 0.5) * 0.32 * varianceScale;
  const performanceShock = {
    home: varianceSwing,
    away: -varianceSwing,
  };
  const ratingGap = Math.abs(profiles.home.overall - profiles.away.overall);
  if (ratingGap >= 4 && settings.fogStrength > 0) {
    const fogSwing = (random() - 0.5) * 0.2 * clamp(settings.fogStrength, 0, 80) / 80;
    performanceShock.home += fogSwing;
    performanceShock.away -= fogSwing;
  } else {
    random(); // keep the later event stream aligned across calibration settings
  }

  const qualityDifference = profiles.home.overall - profiles.away.overall;
  const homeBoost = settings.homeAdvantage / 100;
  const possessionHome = clamp(0.5 + qualityDifference * 0.012 + homeBoost * 0.35
    + (profiles.home.buildup - profiles.away.buildup) * 0.003
    + (shapes.home.midfieldControl - shapes.away.midfieldControl) * 0.012, 0.27, 0.73);
  const possessions = 104 + Math.floor(random() * 17);
  const active = { home: [...home.players], away: [...away.players] };
  const availableBench = { home: [...home.bench], away: [...away.bench] };
  const substitutions = { home: 0, away: 0 };
  const pendingErrors = { home: null, away: null };
  const substitutionThresholds = [60, 70, 78];

  const substitute = (side, minute, forcedPlayer = null) => {
    if (substitutions[side] >= 5 || availableBench[side].length === 0) return false;
    const outCandidates = active[side].filter((player) => player.position !== "GK" && starterIds.has(player.playerId));
    const outgoing = forcedPlayer || outCandidates.sort((a, b) => attr(a, "stamina") - attr(b, "stamina"))[0];
    if (!outgoing) return false;
    const positionGroup = (position) => position === "GK" ? "GK" : ["CB", "LB", "RB", "LWB", "RWB"].includes(position) ? "DEF" : ["CDM", "CM", "CAM", "LM", "RM"].includes(position) ? "MID" : "ATT";
    const targetGroup = positionGroup(outgoing.position);
    const benchIndex = Math.max(0, availableBench[side].findIndex((player) => positionGroup(player.position) === targetGroup));
    const incoming = availableBench[side].splice(benchIndex, 1)[0];
    const activeIndex = active[side].findIndex((player) => player.playerId === outgoing.playerId);
    if (!incoming || activeIndex < 0) return false;
    active[side][activeIndex] = incoming;
    playerLines.get(outgoing.playerId).minutes = Math.min(playerLines.get(outgoing.playerId).minutes, minute);
    playerLines.get(incoming.playerId).minutes = 90 - minute;
    substitutions[side] += 1;
    events.push({ type: "substitution", minute, teamId: teams[side].id, playerId: incoming.playerId, secondaryPlayerId: outgoing.playerId, metadata: { reason: forcedPlayer ? "injury" : "tactical" } });
    return true;
  };

  for (let index = 0; index < possessions; index += 1) {
    const side = random() < possessionHome ? "home" : "away";
    const other = side === "home" ? "away" : "home";
    const team = teams[side];
    const profile = profiles[side];
    const opponentProfile = profiles[other];
    const minute = 1 + Math.floor((index / possessions) * 90);
    const phaseRoll = random();
    const phase = phaseRoll < 0.22 ? "buildup" : phaseRoll < 0.58 ? "progression" : phaseRoll < 0.76 ? "transition" : "chance_creation";
    const baseDelta = phase === "chance_creation" || phase === "transition" ? 2 : phase === "progression" ? 3 : 5;
    if (settings.trackingEnabled !== false) trackingFrames.push({
      second: Math.floor(index / possessions * 5400),
      deltaSeconds: baseDelta,
      phase,
      possessionTeamId: team.id,
      ball: { x: round(side === "home" ? 18 + phaseRoll * 76 : 82 - phaseRoll * 76, 1), y: round(15 + random() * 70, 1) },
      players: [...active.home.map((player) => trackingPosition(player, assignmentFor(home, player), "home", phase, trackingRandom, home, side === "home")),
        ...active.away.map((player) => trackingPosition(player, assignmentFor(away, player), "away", phase, trackingRandom, away, side === "away"))],
    });
    const scheduledWindow = substitutionThresholds[substitutions[side]];
    if (scheduledWindow && minute >= scheduledWindow) substitute(side, minute);
    stats[side].possession += 1;
    const passVolume = (team.tactic.buildUpStyle === "short_passing" ? 4 : 3) + Math.floor(random() * 6);
    stats[side].passes += passVolume;
    for (let passIndex = 0; passIndex < passVolume; passIndex += 1) {
      const passer = chooseWeighted(active[side], (player) => (
        attr(player, "shortPassing") + attr(player, "vision") * 0.35
      ) * passInvolvementWeight(team, player, phase), statRandom);
      const passerLine = playerLines.get(passer.playerId);
      const passerAssignment = assignmentFor(team, passer);
      const passerPosition = passerAssignment.slotPosition || passer.position;
      const receiverCandidates = active[side].filter((player) => player.playerId !== passer.playerId);
      const receiver = chooseWeighted(receiverCandidates, (player) => passInvolvementWeight(team, player, phase), statRandom);
      const receiverLine = playerLines.get(receiver.playerId);
      const widePasser = ["LB", "RB", "LWB", "RWB", "LM", "RM", "LW", "RW"].includes(passerPosition);
      const widthMultiplier = clamp(0.78 + shapes[side].width * 0.11, 0.78, 1.18);
      const isCross = widePasser && ["progression", "chance_creation"].includes(phase) && statRandom() < 0.2 * widthMultiplier;
      const longBallChance = team.tactic.buildUpStyle === "counter" ? 0.2 : team.tactic.buildUpStyle === "short_passing" ? 0.07 : 0.12;
      const isLongBall = !isCross && statRandom() < longBallChance;
      passerLine.passes += 1;
      passerLine.touches += 1;
      const zoneKey = phase === "buildup" ? "passesOwnThird" : phase === "progression" ? "passesMiddleThird" : "passesFinalThird";
      passerLine[zoneKey] += 1;
      stats[side][zoneKey] += 1;
      let completionChance = individualPassSuccess(team, teams[other], passer, phase);
      if (isLongBall) completionChance = clamp(0.32 + attr(passer, "longPassing") * 0.0042 + attr(passer, "vision") * 0.0012, 0.38, 0.84);
      if (isCross) completionChance = clamp(0.22 + attr(passer, "crossing") * 0.0045, 0.28, 0.72);
      let completed = statRandom() < completionChance;
      if (isLongBall) {
        passerLine.longBalls += 1;
        stats[side].longBalls += 1;
      }
      if (isCross) {
        passerLine.crosses += 1;
        const defendingKeeper = active[other].find((player) => (assignmentFor(teams[other], player).slotPosition || player.position) === "GK");
        const keeperLine = defendingKeeper ? playerLines.get(defendingKeeper.playerId) : null;
        const claimAttempt = keeperLine && statRandom() < 0.16;
        if (claimAttempt) {
          keeperLine.claims += 1;
          if (statRandom() < clamp((attr(defendingKeeper, "gkHandling") + attr(defendingKeeper, "gkPositioning")) / 230, 0.45, 0.88)) {
            keeperLine.successfulClaims += 1;
            keeperLine.recoveries += 1;
            completed = false;
          } else if (statRandom() < 0.45) keeperLine.punches += 1;
        }
        if (!claimAttempt || completed) {
          const aerialDefender = chooseWeighted(active[other].filter((player) => player.position !== "GK"), (player) => (
            attr(player, "headingAccuracy") + attr(player, "strength")
          ) * defensiveActionWeight(teams[other], player, phase, "aerial"), statRandom);
          const defenderLine = playerLines.get(aerialDefender.playerId);
          receiverLine.aerialDuels += 1;
          defenderLine.aerialDuels += 1;
          receiverLine.duels += 1;
          defenderLine.duels += 1;
          const attackWins = completed && statRandom() < clamp(
            0.5 + (attr(receiver, "headingAccuracy") + attr(receiver, "strength") - attr(aerialDefender, "headingAccuracy") - attr(aerialDefender, "strength")) / 300,
            0.25, 0.75,
          );
          if (attackWins) {
            receiverLine.aerialDuelsWon += 1;
            receiverLine.duelsWon += 1;
          } else {
            defenderLine.aerialDuelsWon += 1;
            defenderLine.duelsWon += 1;
            defenderLine.clearances += 1;
            defenderLine.recoveries += 1;
            completed = false;
          }
        }
        if (completed) passerLine.completedCrosses += 1;
      }
      if (completed) {
        passerLine.completedPasses += 1;
        stats[side].completedPasses += 1;
        receiverLine.touches += 1;
        if (isLongBall) {
          passerLine.completedLongBalls += 1;
          stats[side].completedLongBalls += 1;
        }
      } else if (!isCross && statRandom() < 0.2) {
        const interceptor = chooseWeighted(active[other].filter((player) => player.position !== "GK"), (player) => (
          attr(player, "interceptions") + attr(player, "defensiveAwareness")
        ) * defensiveActionWeight(teams[other], player, phase, "interception"), statRandom);
        const interceptorLine = playerLines.get(interceptor.playerId);
        interceptorLine.interceptions += 1;
        interceptorLine.recoveries += 1;
      }
      if (!completed && !isCross && ["buildup", "progression"].includes(phase)
        && statRandom() < clamp(0.035 + (75 - attr(passer, "composure")) / 500, 0.02, 0.12)) {
        pendingErrors[side] = passerLine;
      }
      const progressive = completed && phase !== "buildup" && statRandom() < 0.24;
      if (progressive) passerLine.progressivePasses += 1;
      const [fromX, fromY] = assignmentCoordinate(team, passer, passerAssignment);
      const [toX, toY] = assignmentCoordinate(team, receiver);
      if (passerLine.passMap.length < 18) passerLine.passMap.push({
        fromX: round(clamp(fromX + (statRandom() - 0.5) * 8, 1, 99), 1), fromY: round(clamp(fromY + (statRandom() - 0.5) * 8, 1, 99), 1),
        toX: round(clamp(toX + (statRandom() - 0.5) * 8, 1, 99), 1), toY: round(clamp(toY + (statRandom() - 0.5) * 8, 1, 99), 1),
        completed, progressive, longBall: isLongBall, cross: isCross,
      });
    }
    const carrier = chooseWeighted(active[side], (player) => {
      const assignment = assignmentFor(team, player);
      const execution = roleFamiliarity(player, assignment.slotPosition || player.position, assignment.role).multiplier;
      return (attr(player, "ballControl") + attr(player, "dribbling")) * Math.max(0.05, execution);
    }, statRandom);
    const carrierLine = playerLines.get(carrier.playerId);
    carrierLine.carries += 1;
    carrierLine.touches += 2;
    if (phase === "transition" || statRandom() < 0.18) carrierLine.progressiveCarries += 1;
    const defendingApproach = teams[other].tactic.defensiveApproach;
    const pressureChance = defendingApproach === "aggressive" ? 0.48 : defendingApproach === "high" ? 0.37 : defendingApproach === "deep" ? 0.14 : 0.25;
    if (statRandom() < pressureChance) {
      const defender = chooseWeighted(active[other], (player) => (
        attr(player, "standingTackle") + attr(player, "interceptions")
      ) * defensiveActionWeight(teams[other], player, phase, "pressure"), statRandom);
      const defenderLine = playerLines.get(defender.playerId);
      defenderLine.pressures += 1;
      if (defender.position !== "GK" && statRandom() < 0.58) {
        carrierLine.dribbles += 1;
        carrierLine.duels += 1;
        defenderLine.duels += 1;
        const attackerWins = statRandom() < clamp(
          0.48 + (attr(carrier, "dribbling") + attr(carrier, "agility") - attr(defender, "standingTackle") - attr(defender, "strength")) / 320,
          0.24, 0.76,
        );
        if (attackerWins) {
          carrierLine.successfulDribbles += 1;
          carrierLine.duelsWon += 1;
        } else {
          carrierLine.dispossessed += 1;
          defenderLine.tackles += 1;
          defenderLine.duelsWon += 1;
          defenderLine.recoveries += 1;
        }
      }
    }

    if (random() < 0.0008 * settings.injuryFrequency / 50) {
      const injured = chooseWeighted(active[side].filter((player) => player.position !== "GK"), (player) => 110 - attr(player, "stamina"), random);
      events.push({ type: "injury", minute, teamId: team.id, playerId: injured.playerId, secondaryPlayerId: null, metadata: { severity: random() < 0.2 ? "major" : random() < 0.55 ? "moderate" : "minor" } });
      substitute(side, minute, injured);
    }

    // Discipline belongs to the possession duel, not only to shots on target.
    const defensiveTactic = teams[other].tactic;
    const aggressionMultiplier = defensiveTactic.defensiveApproach === "aggressive" ? 1.45
      : defensiveTactic.defensiveApproach === "high" ? 1.2 : defensiveTactic.defensiveApproach === "deep" ? 0.78 : 1;
    const lineMultiplier = 0.8 + clamp(Number(defensiveTactic.lineHeight || 50), 0, 100) / 250;
    if (random() < 0.1 * (0.7 + settings.disciplineFrequency / 100) * aggressionMultiplier * lineMultiplier) {
      const eligibleOffenders = active[other].filter((player) => player.position !== "GK");
      if (eligibleOffenders.length > 0) {
        const offender = chooseWeighted(eligibleOffenders, (player) => (
          attr(player, "aggression") * defensiveActionWeight(teams[other], player, phase, "foul")
        ), random);
        const line = playerLines.get(offender.playerId);
        line.fouls += 1;
        carrierLine.fouled += 1;
        stats[other].fouls += 1;
        const card = random() < clamp(0.16 + settings.disciplineFrequency / 500 + (attr(offender, "aggression") - 60) / 500, 0.12, 0.42);
        if (card) {
          const secondYellow = line.yellowCards > 0;
          const red = secondYellow || random() < 0.035;
          events.push({ type: red ? "red_card" : "yellow_card", minute, teamId: teams[other].id, playerId: offender.playerId, secondaryPlayerId: null, metadata: secondYellow ? { secondYellow: true } : {} });
          if (red) {
            line.redCards = 1;
            stats[other].redCards += 1;
            line.minutes = Math.min(line.minutes, minute);
            active[other] = active[other].filter((player) => player.playerId !== offender.playerId);
          } else {
            line.yellowCards = 1;
            stats[other].yellowCards += 1;
          }
        }
      }
    }

    const qualityEdge = (profile.overall - opponentProfile.overall) * settings.overallInfluence / 35000;
    const creationEdge = (profile.creation - opponentProfile.defence) * settings.tacticalInfluence / 42000;
    const fatiguePenalty = profile.fatigue * settings.fatigueEffect / 200000;
    const shapeMultiplier = clamp(1
      + (shapes[side].attackingPresence - 2.7) * 0.055
      - (shapes[other].defensiveCoverage - 4.1) * 0.055, 0.84, 1.16);
    const tacticalMultiplier = tacticalAttackMultiplier(team, teams[other]) * shapeMultiplier;
    const homeChanceBonus = side === "home" ? settings.homeAdvantage / 450 : 0;
    const chanceProbability = clamp((0.19 + homeChanceBonus + qualityEdge + creationEdge + performanceShock[side] - fatiguePenalty) * tacticalMultiplier * (0.9 + settings.goalEnvironment / 500), 0.025, 0.34);
    if (random() >= chanceProbability) continue;
    const causalErrorLine = pendingErrors[other];
    if (causalErrorLine) {
      causalErrorLine.errorsLeadingToShot += 1;
      pendingErrors[other] = null;
    }
    if (settings.trackingEnabled !== false) trackingFrames.push({
      second: Math.floor(index / possessions * 5400) + 1, deltaSeconds: 1, phase: "chance_creation",
      possessionTeamId: team.id, ball: { x: side === "home" ? 88 : 12, y: round(20 + random() * 60, 1) },
      players: [...active.home.map((player) => trackingPosition(player, assignmentFor(home, player), "home", "chance_creation", trackingRandom, home, side === "home")),
        ...active.away.map((player) => trackingPosition(player, assignmentFor(away, player), "away", "chance_creation", trackingRandom, away, side === "away"))],
    });

    const shotTypeRoll = random();
    const shotType = shotTypeRoll < 0.16 ? "header" : shotTypeRoll < 0.31 ? "long_shot" : "open_play";
    const activeTeam = { ...team, players: active[side] };
    const shooter = chooseScorer(activeTeam, shotType, random);
    const shooterLine = playerLines.get(shooter.playerId);
    const offsideChance = 0.012 + clamp(Number(teams[other].tactic.lineHeight || 50), 0, 100) / 1150
      + (team.tactic.buildUpStyle === "counter" ? 0.018 : 0);
    if (random() < offsideChance) {
      shooterLine.offsides += 1;
      stats[side].offsides += 1;
      events.push({ type: "offside", minute, teamId: team.id, playerId: shooter.playerId, secondaryPlayerId: null, metadata: { defensiveLine: teams[other].tactic.lineHeight } });
      continue;
    }
    const defendingKeeper = active[other].find((player) => (assignmentFor(teams[other], player).slotPosition || player.position) === "GK");
    if (phase === "transition" && defendingKeeper && random() < 0.07) {
      const keeperLine = playerLines.get(defendingKeeper.playerId);
      keeperLine.sweeperActions += 1;
      keeperLine.recoveries += 1;
      continue;
    }
    const creators = active[side].filter((player) => player.playerId !== shooter.playerId
      && (assignmentFor(team, player).slotPosition || player.position) !== "GK");
    const creator = creators.length > 0 && statRandom() < 0.78
      ? chooseWeighted(creators, (player) => {
        const assignment = assignmentFor(team, player);
        const roleBonus = ["playmaker", "wide_playmaker", "false_9", "deep_lying_playmaker"].includes(assignment.role) ? 1.35 : 1;
        return (attr(player, "vision") + attr(player, "shortPassing") + attr(player, "crossing") * 0.4) * roleBonus;
      }, statRandom)
      : null;
    const baseXg = shotType === "header" ? 0.2 : shotType === "long_shot" ? 0.1 : 0.24;
    const transitionBonus = team.tactic.buildUpStyle === "counter" && ["high", "aggressive"].includes(teams[other].tactic.defensiveApproach) ? 0.09 : 0;
    const shotXg = clamp(baseXg + transitionBonus + (attr(shooter, "finishing") - opponentProfile.goalkeeper) / 500 + qualityEdge * 0.45 + (random() - 0.5) * 0.09, 0.02, 0.72);
    stats[side].shots += 1;
    stats[side].xg += shotXg;
    shooterLine.xg += shotXg;
    if (creator) {
      const creatorLine = playerLines.get(creator.playerId);
      creatorLine.keyPasses += 1;
      creatorLine.xa += shotXg;
    }
    if (shotXg >= 0.35) { stats[side].bigChances += 1; shooterLine.bigChances += 1; }
    shooterLine.shots += 1;
    const blockChance = teams[other].tactic.defensiveApproach === "deep" ? 0.22 : teams[other].tactic.defensiveApproach === "aggressive" ? 0.1 : 0.15;
    const blocked = random() < blockChance;
    if (blocked) {
      const blocker = chooseWeighted(active[other].filter((player) => player.position !== "GK"), (player) => (
        attr(player, "defensiveAwareness") + attr(player, "standingTackle")
      ) * defensiveActionWeight(teams[other], player, phase, "block"), statRandom);
      const blockerLine = playerLines.get(blocker.playerId);
      blockerLine.blocks += 1;
      if (random() < 0.35) {
        blockerLine.clearances += 1;
        blockerLine.recoveries += 1;
      }
      shooterLine.shotMap.push({ minute, x: round(78 + random() * 19, 1), y: round(15 + random() * 70, 1), xg: round(shotXg, 3), onTarget: false, outcome: "blocked" });
      events.push({ type: "shot", minute, teamId: team.id, playerId: shooter.playerId, secondaryPlayerId: blocker.playerId, metadata: { outcome: "blocked", shotType, xg: round(shotXg, 3) } });
      if (random() < 0.28) stats[side].corners += 1;
      continue;
    }
    const onTarget = random() < clamp(0.34 + attr(shooter, "finishing") / 260, 0.35, 0.76);
    const shotPoint = { minute, x: round(78 + random() * 19, 1), y: round(15 + random() * 70, 1), xg: round(shotXg, 3), onTarget, outcome: "off_target" };
    shooterLine.shotMap.push(shotPoint);
    if (!onTarget) {
      if (shotXg >= 0.35) { stats[side].bigChancesMissed += 1; shooterLine.bigChancesMissed += 1; }
      events.push({ type: "shot", minute, teamId: team.id, playerId: shooter.playerId, secondaryPlayerId: null, metadata: { outcome: "off_target", shotType, xg: round(shotXg, 3) } });
      continue;
    }
    stats[side].shotsOnTarget += 1;
    shooterLine.shotsOnTarget += 1;
    const shotXgot = clamp(shotXg * (0.75 + random() * 0.75), 0.01, 0.95);
    stats[side].xgot += shotXgot;
    shooterLine.xgot += shotXgot;

    if (random() < shotXg) {
      const assister = creator;
      shooterLine.goals += 1;
      if (causalErrorLine) causalErrorLine.errorsLeadingToGoal += 1;
      if (assister) {
        playerLines.get(assister.playerId).assists += 1;
      }
      shotPoint.outcome = "goal";
      events.push({ type: "goal", minute, teamId: team.id, playerId: shooter.playerId, secondaryPlayerId: assister?.playerId || null, metadata: { shotType, xg: round(shotXg, 3) } });
    } else {
      shotPoint.outcome = "saved";
      stats[other].saves += 1;
      const keeper = teams[other].players.find((player) => (assignmentFor(teams[other], player).slotPosition || player.position) === "GK");
      if (keeper) {
        playerLines.get(keeper.playerId).saves += 1;
        events.push({ type: "shot", minute, teamId: team.id, playerId: shooter.playerId, secondaryPlayerId: keeper.playerId, metadata: { outcome: "saved", shotType, xg: round(shotXg, 3), xgot: round(shotXgot, 3) } });
        events.push({ type: "save", minute, teamId: teams[other].id, playerId: keeper.playerId, secondaryPlayerId: shooter.playerId, metadata: { xgot: round(shotXgot, 3) } });
      }
      if (random() < 0.18) stats[side].corners += 1;
    }

  }

  const totalPossessions = stats.home.possession + stats.away.possession;
  stats.home.possession = round(stats.home.possession / totalPossessions * 100, 1);
  stats.away.possession = round(100 - stats.home.possession, 1);
  stats.home.xg = round(stats.home.xg, 3);
  stats.away.xg = round(stats.away.xg, 3);
  stats.home.xgot = round(stats.home.xgot, 3);
  stats.away.xgot = round(stats.away.xgot, 3);
  events.sort((a, b) => a.minute - b.minute);
  events.forEach((event, sequence) => { event.sequence = sequence; });
  const homeScore = events.filter((event) => event.type === "goal" && event.teamId === home.id).length;
  const awayScore = events.filter((event) => event.type === "goal" && event.teamId === away.id).length;
  for (const [side, other, conceded] of [["home", "away", awayScore], ["away", "home", homeScore]]) {
    const keeper = teams[side].players.find((player) => (assignmentFor(teams[side], player).slotPosition || player.position) === "GK");
    const keeperLine = keeper ? playerLines.get(keeper.playerId) : null;
    const goalsPrevented = round(stats[other].xgot - conceded, 2);
    stats[side].goalsPrevented = goalsPrevented;
    if (keeperLine) {
      keeperLine.shotsFaced = stats[other].shotsOnTarget;
      keeperLine.goalsConceded = conceded;
      keeperLine.goalsPrevented = goalsPrevented;
    }
  }
  const resultFor = (teamId) => teamId === home.id ? Math.sign(homeScore - awayScore) : Math.sign(awayScore - homeScore);
  for (const line of playerLines.values()) {
    const player = allPlayers.find((candidate) => candidate.playerId === line.playerId);
    const position = line.slotPosition || player?.position || "CM";
    const group = position === "GK" ? "GK" : ["CB", "LB", "RB", "LWB", "RWB"].includes(position) ? "DEF" : ["CDM", "CM", "CAM", "LM", "RM"].includes(position) ? "MID" : "ATT";
    const goalWeight = group === "GK" || group === "DEF" ? 1.15 : group === "MID" ? 0.95 : 0.82;
    const passAccuracy = line.passes > 0 ? line.completedPasses / line.passes : 0.75;
    const expectedPassAccuracy = group === "GK" ? 0.72 : group === "DEF" ? 0.78 : group === "MID" ? 0.76 : 0.7;
    const opponentScore = line.teamId === home.id ? awayScore : homeScore;
    const cleanSheet = opponentScore === 0 && (group === "GK" || group === "DEF") ? 0.18 : 0;
    const scoringContribution = line.goals * goalWeight + line.assists * 0.55;
    const possessionContribution = line.keyPasses * 0.045 + line.progressivePasses * 0.005
      + (passAccuracy - expectedPassAccuracy) * Math.min(0.55, line.passes / 45);
    const defendingContribution = line.tackles * 0.045 + line.interceptions * 0.035
      + line.recoveries * 0.012 + line.blocks * 0.05 + line.clearances * 0.012 + line.duelsWon * 0.01;
    const goalkeepingContribution = group === "GK" ? line.saves * 0.05 + line.goalsPrevented * 0.3 : 0;
    const assignment = assignmentFor(line.teamId === home.id ? home : away, player);
    const execution = roleFamiliarity(player, position, assignment.role).multiplier;
    const positionPenalty = execution === 0 ? 3.15 : execution < 0.5 ? (0.5 - execution) * 2.2 : 0;
    const negativeContribution = line.fouls * 0.025 + line.yellowCards * 0.16 + line.redCards * 1.4
      + line.errorsLeadingToShot * 0.28 + line.errorsLeadingToGoal * 0.72
      + line.bigChancesMissed * 0.13 + line.dispossessed * 0.008 + positionPenalty;
    const contribution = scoringContribution + possessionContribution + defendingContribution
      + goalkeepingContribution + cleanSheet + resultFor(line.teamId) * 0.1 - negativeContribution;
    const minutesWeight = clamp(line.minutes / 45, 0.35, 1);
    line.ratingComponents = {
      base: 6.35, scoring: round(scoringContribution * minutesWeight, 2),
      possession: round(possessionContribution * minutesWeight, 2),
      defending: round((defendingContribution + goalkeepingContribution + cleanSheet) * minutesWeight, 2),
      discipline: round(-negativeContribution * minutesWeight, 2),
    };
    line.rating = round(clamp(6.35 + contribution * minutesWeight, 1, 10), 1);
    const lineTeam = line.teamId === home.id ? home : away;
    const lineAssignment = assignmentFor(lineTeam, player);
    const intensityMultiplier = lineTeam.tactic.defensiveApproach === "aggressive" ? 1.08
      : lineTeam.tactic.defensiveApproach === "high" ? 1.04 : lineTeam.tactic.defensiveApproach === "deep" ? 0.96 : 1;
    line.fatigueDelta = round(clamp((18 + (100 - attr(player, "stamina")) * 0.16) * intensityMultiplier, 10, 42), 2);
    const trackedPositions = settings.trackingEnabled === false ? [] : trackingFrames.flatMap((frame) => {
      const tracked = frame.players.find((candidate) => candidate.playerId === line.playerId);
      if (!tracked) return [];
      return [{ x: line.teamId === home.id ? tracked.x : 100 - tracked.x, y: tracked.y }];
    });
    line.heatmap = trackedPositions.length ? heatmapFromPositions(trackedPositions) : [];
    const baseDistance = group === "GK" ? 4.6 : group === "DEF" ? 9.3 : group === "MID" ? 10.8 : 9.8;
    line.distanceKm = round(baseDistance * line.minutes / 90 * (0.91 + statRandom() * 0.18) * intensityMultiplier, 2);
    const counterSprintMultiplier = lineTeam.tactic.buildUpStyle === "counter" && group === "ATT" ? 1.18 : 1;
    line.highSpeedDistanceKm = round(group === "GK"
      ? line.distanceKm * (0.035 + statRandom() * 0.02)
      : line.distanceKm * (0.045 + attr(player, "sprintSpeed") / 3200 + attr(player, "acceleration") / 5000) * counterSprintMultiplier, 2);
    line.sprintDistanceKm = round(group === "GK"
      ? line.highSpeedDistanceKm * (0.2 + statRandom() * 0.18)
      : line.highSpeedDistanceKm * (0.14 + attr(player, "acceleration") / 850 + statRandom() * 0.06), 2);
    line.maxSpeedKmh = round(group === "GK"
      ? 22 + statRandom() * 4
      : 20.5 + attr(player, "sprintSpeed") * 0.11 + attr(player, "acceleration") * 0.018 + statRandom() * 1.5, 1);
    line.sprintCount = Math.max(0, Math.round(line.sprintDistanceKm * (group === "GK" ? 28 : 24)));
    if (trackedPositions.length) {
      line.averagePosition = {
        x: round(average(trackedPositions.map((position) => position.x)), 1),
        y: round(average(trackedPositions.map((position) => position.y)), 1),
      };
    } else {
      const [avgX, avgY] = assignmentCoordinate(lineTeam, player, lineAssignment);
      line.averagePosition = { x: avgX, y: avgY };
    }
  }

  for (const side of ["home", "away"]) {
    const lines = [...playerLines.values()].filter((line) => line.teamId === teams[side].id && line.minutes > 0);
    for (const key of ["shots", "shotsOnTarget", "passes", "completedPasses", "progressivePasses", "crosses", "completedCrosses", "carries", "progressiveCarries", "dribbles", "successfulDribbles", "pressures", "tackles", "interceptions", "recoveries", "blocks", "clearances", "duels", "duelsWon", "aerialDuels", "aerialDuelsWon", "keyPasses", "fouls", "yellowCards", "redCards", "offsides", "longBalls", "completedLongBalls", "passesOwnThird", "passesMiddleThird", "passesFinalThird"]) {
      stats[side][key] = lines.reduce((sum, line) => sum + line[key], 0);
    }
    stats[side].fieldTilt = round(clamp(stats[side].possession + (stats[side].shots - stats[side === "home" ? "away" : "home"].shots) * 1.4, 0, 100), 1);
  }
  const chunks = [];
  for (let start = 0; start < trackingFrames.length; start += 40) chunks.push({ index: chunks.length, frames: trackingFrames.slice(start, start + 40) });
  return {
    matchId, seed, engineVersion: "fc25-il-2", calibrationVersion: "sofascore-v1", source: "simulated",
    homeScore, awayScore, events, teamStats: stats, playerStats: [...playerLines.values()].filter((line) => line.minutes > 0),
    tracking: { resolution: "adaptive-1-5s", chunks },
  };
}

export function simulateConstrainedMatch({ homeScore, awayScore, ...input }) {
  const result = simulateMatch(input);
  const random = seededRandom(`${input.seed}:${input.matchId}:manual-constrained`);
  result.source = "manual_constrained";
  result.events = result.events.filter((event) => event.type !== "goal");
  for (const line of result.playerStats) {
    line.goals = 0;
    line.assists = 0;
  }
  const addGoals = (team, score, side) => {
    const lines = result.playerStats
      .filter((line) => line.teamId === team.id && line.minutes > 0)
      .sort((a, b) => {
        const playerA = [...team.players, ...team.bench].find((player) => player.playerId === a.playerId);
        const playerB = [...team.players, ...team.bench].find((player) => player.playerId === b.playerId);
        return attr(playerB, "finishing") - attr(playerA, "finishing");
      });
    for (let index = 0; index < score; index += 1) {
      const scorer = lines[index % Math.min(4, lines.length)];
      const assister = lines[(index + 3) % lines.length];
      const minute = Math.min(89, 8 + Math.floor((index + 1) * 78 / (score + 1)) + Math.floor(random() * 5));
      const xg = round(clamp(0.18 + random() * 0.38, 0.08, 0.72), 3);
      scorer.goals += 1;
      scorer.shots = Math.max(scorer.shots, scorer.goals + 1);
      scorer.shotsOnTarget = Math.max(scorer.shotsOnTarget, scorer.goals);
      scorer.xg = round(Math.max(scorer.xg, scorer.goals * xg), 3);
      scorer.xgot = round(Math.max(scorer.xgot, scorer.goals * Math.min(0.9, xg * 1.2)), 3);
      scorer.rating = round(clamp(scorer.rating + 0.65, 1, 10), 1);
      if (assister && assister.playerId !== scorer.playerId && random() > 0.18) {
        assister.assists += 1;
        assister.keyPasses += 1;
        assister.xa = round(Number(assister.xa || 0) + xg, 3);
        assister.rating = round(clamp(assister.rating + 0.35, 1, 10), 1);
      }
      result.events.push({
        type: "goal", minute, teamId: team.id, playerId: scorer.playerId,
        secondaryPlayerId: assister?.playerId || null, metadata: { shotType: "manual_constrained", xg, synthetic: true },
      });
    }
    result.teamStats[side].shots = lines.reduce((sum, line) => sum + line.shots, 0);
    result.teamStats[side].shotsOnTarget = lines.reduce((sum, line) => sum + line.shotsOnTarget, 0);
    result.teamStats[side].xg = round(lines.reduce((sum, line) => sum + Number(line.xg || 0), 0), 3);
    result.teamStats[side].xgot = round(lines.reduce((sum, line) => sum + Number(line.xgot || 0), 0), 3);
    result.teamStats[side].keyPasses = lines.reduce((sum, line) => sum + line.keyPasses, 0);
  };
  addGoals(input.home, homeScore, "home");
  addGoals(input.away, awayScore, "away");
  result.homeScore = homeScore;
  result.awayScore = awayScore;
  for (const [side, other, conceded] of [["home", "away", awayScore], ["away", "home", homeScore]]) {
    const keeper = result.playerStats.find((line) => line.teamId === input[side].id && line.slotPosition === "GK");
    if (!keeper) continue;
    keeper.goalsConceded = conceded;
    keeper.shotsFaced = result.teamStats[other].shotsOnTarget;
    keeper.saves = Math.max(0, keeper.shotsFaced - conceded);
    keeper.goalsPrevented = round(result.teamStats[other].xgot - conceded, 2);
    result.teamStats[side].saves = keeper.saves;
    result.teamStats[side].goalsPrevented = keeper.goalsPrevented;
  }
  result.events.sort((a, b) => a.minute - b.minute);
  result.events.forEach((event, sequence) => { event.sequence = sequence; });
  return result;
}
