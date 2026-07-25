import test from "node:test";
import assert from "node:assert/strict";

import { simulateConstrainedMatch, simulateMatch } from "../lib/simulation/engine.mjs";

const makeTeam = (id, rating, overrides = {}) => {
  const positions = ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CM", "LW", "RW", "ST"];
  const players = positions.map((position, index) => ({
    playerId: `${id}-${index}`,
    name: `${id} ${index}`,
    position,
    rating,
    finishing: position === "ST" ? rating + 5 : rating - 8,
    headingAccuracy: rating,
    longShots: rating - 4,
    shortPassing: rating,
    longPassing: rating,
    vision: rating,
    crossing: rating,
    ballControl: rating,
    composure: rating,
    positioning: rating,
    acceleration: rating,
    sprintSpeed: rating,
    stamina: rating,
    aggression: rating,
    interceptions: rating,
    defensiveAwareness: rating,
    standingTackle: rating,
    gkDiving: position === "GK" ? rating : 10,
    gkHandling: position === "GK" ? rating : 10,
    gkPositioning: position === "GK" ? rating : 10,
    gkReflexes: position === "GK" ? rating : 10,
  }));
  const defaultRoles = [
    ["goalkeeper", "defend"], ["fullback", "defend"], ["defender", "defend"],
    ["defender", "defend"], ["fullback", "defend"], ["holding", "defend"],
    ["box_to_box", "balanced"], ["playmaker", "roaming"], ["inside_forward", "attack"],
    ["winger", "attack"], ["advanced_forward", "complete"],
  ];
  const bench = Array.from({ length: 7 }, (_, index) => ({
    ...players[Math.min(10, index + 1)],
    playerId: `${id}-bench-${index}`,
    name: `${id} bench ${index}`,
    position: positions[Math.min(10, index + 1)],
  }));
  return {
    id,
    players,
    bench,
    tactic: {
      formation: "4-3-3",
      buildUpStyle: "balanced",
      defensiveApproach: "balanced",
      lineHeight: 50,
      assignments: defaultRoles.map(([role, focus], slotIndex) => ({
        slotIndex, slotPosition: positions[slotIndex], playerId: players[slotIndex].playerId, role, focus,
      })),
    },
    ...overrides,
  };
};

const makeFormationTeam = (id, rating, formation, positions) => {
  const team = makeTeam(id, rating);
  const roleFor = (position) => position === "GK" ? ["goalkeeper", "defend"]
    : ["CB"].includes(position) ? ["defender", "defend"]
      : ["LB", "RB"].includes(position) ? ["fullback", "balanced"]
        : ["LWB", "RWB"].includes(position) ? ["wingback", "balanced"]
          : position === "CDM" ? ["holding", "defend"]
            : position === "CM" ? ["box_to_box", "balanced"]
              : ["CAM"].includes(position) ? ["playmaker", "roaming"]
                : ["LM", "RM", "LW", "RW"].includes(position) ? ["winger", "attack"]
                  : ["advanced_forward", "complete"];
  team.players = positions.map((position, index) => ({
    ...team.players[index],
    position,
    positions: position,
    finishing: ["ST", "CF"].includes(position) ? rating + 5 : rating - 8,
    gkDiving: position === "GK" ? rating : 10,
    gkHandling: position === "GK" ? rating : 10,
    gkPositioning: position === "GK" ? rating : 10,
    gkReflexes: position === "GK" ? rating : 10,
  }));
  team.tactic = {
    ...team.tactic,
    formation,
    assignments: positions.map((slotPosition, slotIndex) => {
      const [role, focus] = roleFor(slotPosition);
      return { slotIndex, slotPosition, playerId: team.players[slotIndex].playerId, role, focus };
    }),
  };
  return team;
};

const settings = {
  overallInfluence: 60, tacticalInfluence: 25, homeAdvantage: 5,
  variance: 50, fogStrength: 40, fatigueEffect: 50,
  injuryFrequency: 50, disciplineFrequency: 50, goalEnvironment: 50, trackingEnabled: false,
};

test("identical inputs and seed produce byte-identical match output", () => {
  const input = { matchId: "m1", seed: "seed-1", home: makeTeam("home", 80), away: makeTeam("away", 80), settings };
  assert.deepEqual(simulateMatch(input), simulateMatch(input));
});

test("player involvement follows tactical position instead of distributing actions uniformly", () => {
  const totals = new Map();
  for (let index = 0; index < 60; index += 1) {
    const result = simulateMatch({
      matchId: `role-distribution-${index}`,
      seed: `role-distribution-${index}`,
      home: makeTeam("home", 80),
      away: makeTeam("away", 80),
      settings,
    });
    for (const line of result.playerStats.filter((player) => player.teamId === "home" && player.starter)) {
      const total = totals.get(line.slotPosition) || { appearances: 0, passes: 0, shots: 0 };
      total.appearances += 1;
      total.passes += line.passes;
      total.shots += line.shots;
      totals.set(line.slotPosition, total);
    }
  }
  const perAppearance = (position, stat) => totals.get(position)[stat] / totals.get(position).appearances;
  const midfieldPasses = averageForTest(["CDM", "CM"], (position) => perAppearance(position, "passes"));
  const forwardPasses = averageForTest(["LW", "RW", "ST"], (position) => perAppearance(position, "passes"));
  const centreBackPasses = perAppearance("CB", "passes");
  const goalkeeperPasses = perAppearance("GK", "passes");
  assert.ok(midfieldPasses > forwardPasses * 1.3, `midfield ${midfieldPasses.toFixed(1)} vs forwards ${forwardPasses.toFixed(1)}`);
  assert.ok(centreBackPasses > forwardPasses, `centre backs ${centreBackPasses.toFixed(1)} vs forwards ${forwardPasses.toFixed(1)}`);
  assert.ok(goalkeeperPasses < midfieldPasses * 0.65, `goalkeeper ${goalkeeperPasses.toFixed(1)} vs midfield ${midfieldPasses.toFixed(1)}`);
  assert.ok(perAppearance("ST", "shots") > perAppearance("CB", "shots") * 4, "strikers must dominate centre backs for shots");
  assert.equal(perAppearance("GK", "shots"), 0);
});

test("goalkeeper outcomes reconcile shots faced, goals conceded and goals prevented", () => {
  const result = simulateMatch({
    matchId: "keeper-reconciliation",
    seed: "keeper-reconciliation",
    home: makeTeam("home", 80),
    away: makeTeam("away", 80),
    settings,
  });
  for (const [side, opponent, conceded] of [
    ["home", "away", result.awayScore],
    ["away", "home", result.homeScore],
  ]) {
    const keeper = result.playerStats.find((line) => line.teamId === side && line.slotPosition === "GK");
    assert.equal(keeper.shotsFaced, result.teamStats[opponent].shotsOnTarget);
    assert.equal(keeper.goalsConceded, conceded);
    assert.equal(keeper.saves + keeper.goalsConceded, keeper.shotsFaced);
    assert.equal(keeper.goalsPrevented, Number((result.teamStats[opponent].xgot - conceded).toFixed(2)));
    assert.equal(result.teamStats[side].goalsPrevented, keeper.goalsPrevented);
  }
});

test("individual passing quality and risk produce distinct completion rates", () => {
  const home = makeTeam("home", 80);
  Object.assign(home.players[6], { shortPassing: 94, vision: 92, composure: 93 });
  Object.assign(home.players[7], { shortPassing: 48, vision: 52, composure: 50 });
  let elitePasses = 0; let eliteCompleted = 0; let weakPasses = 0; let weakCompleted = 0;
  for (let index = 0; index < 50; index += 1) {
    const result = simulateMatch({
      matchId: `passing-quality-${index}`,
      seed: `passing-quality-${index}`,
      home,
      away: makeTeam("away", 80),
      settings,
    });
    const elite = result.playerStats.find((line) => line.playerId === "home-6");
    const weak = result.playerStats.find((line) => line.playerId === "home-7");
    elitePasses += elite.passes; eliteCompleted += elite.completedPasses;
    weakPasses += weak.passes; weakCompleted += weak.completedPasses;
  }
  const eliteAccuracy = eliteCompleted / elitePasses;
  const weakAccuracy = weakCompleted / weakPasses;
  assert.ok(eliteAccuracy > weakAccuracy + 0.08, `elite ${eliteAccuracy.toFixed(3)} vs weak ${weakAccuracy.toFixed(3)}`);
  assert.ok(eliteAccuracy < 0.96, "even elite passers must reflect match pressure and risk");
});

test("all displayed action families are generated causally and reconcile to team totals", () => {
  const observed = {
    blocks: 0, clearances: 0, aerialDuels: 0, offsides: 0, fouled: 0,
    claims: 0, longBalls: 0, passesFinalThird: 0, errorsLeadingToShot: 0,
  };
  const reconciled = [
    "shots", "shotsOnTarget", "passes", "completedPasses", "progressivePasses",
    "keyPasses", "crosses", "completedCrosses", "carries", "progressiveCarries",
    "dribbles", "successfulDribbles", "pressures", "tackles", "interceptions",
    "recoveries", "blocks", "clearances", "duels", "duelsWon", "aerialDuels",
    "aerialDuelsWon", "fouls", "yellowCards", "redCards", "offsides",
    "longBalls", "completedLongBalls", "passesOwnThird", "passesMiddleThird", "passesFinalThird",
  ];
  for (let index = 0; index < 40; index += 1) {
    const result = simulateMatch({
      matchId: `action-audit-${index}`,
      seed: `action-audit-${index}`,
      home: makeTeam("home", 80),
      away: makeTeam("away", 80),
      settings,
    });
    for (const side of ["home", "away"]) {
      const lines = result.playerStats.filter((line) => line.teamId === side);
      for (const key of reconciled) {
        assert.equal(lines.reduce((sum, line) => sum + Number(line[key] || 0), 0), result.teamStats[side][key], `${side} ${key}`);
      }
      assert.ok(result.teamStats[side].fouls >= result.teamStats[side].yellowCards + result.teamStats[side].redCards);
      assert.ok(result.teamStats[side].completedLongBalls <= result.teamStats[side].longBalls);
      assert.equal(
        result.teamStats[side].passesOwnThird + result.teamStats[side].passesMiddleThird + result.teamStats[side].passesFinalThird,
        result.teamStats[side].passes,
      );
      for (const key of Object.keys(observed)) observed[key] += lines.reduce((sum, line) => sum + Number(line[key] || 0), 0);
    }
  }
  for (const [key, total] of Object.entries(observed)) assert.ok(total > 0, `${key} must occur in the calibrated sample`);
});

test("tactical choices create recognizable statistical signatures", () => {
  const totals = {
    short: { passes: 0, completedPasses: 0 },
    counter: { passes: 0, completedPasses: 0 },
    aggressive: { pressures: 0, fouls: 0, distance: 0 },
    deep: { pressures: 0, fouls: 0, distance: 0 },
  };
  for (let index = 0; index < 50; index += 1) {
    const short = makeTeam("short", 80);
    short.tactic.buildUpStyle = "short_passing";
    const counter = makeTeam("counter", 80);
    counter.tactic.buildUpStyle = "counter";
    const aggressive = makeTeam("aggressive", 80);
    aggressive.tactic.defensiveApproach = "aggressive";
    aggressive.tactic.lineHeight = 82;
    const deep = makeTeam("deep", 80);
    deep.tactic.defensiveApproach = "deep";
    deep.tactic.lineHeight = 28;
    const passingMatch = simulateMatch({ matchId: `passing-tactics-${index}`, seed: `passing-tactics-${index}`, home: short, away: counter, settings });
    totals.short.passes += passingMatch.teamStats.home.passes;
    totals.short.completedPasses += passingMatch.teamStats.home.completedPasses;
    totals.counter.passes += passingMatch.teamStats.away.passes;
    totals.counter.completedPasses += passingMatch.teamStats.away.completedPasses;
    const defenceMatch = simulateMatch({ matchId: `defence-tactics-${index}`, seed: `defence-tactics-${index}`, home: aggressive, away: deep, settings });
    for (const [side, key] of [["home", "aggressive"], ["away", "deep"]]) {
      totals[key].pressures += defenceMatch.teamStats[side].pressures;
      totals[key].fouls += defenceMatch.teamStats[side].fouls;
      totals[key].distance += defenceMatch.playerStats.filter((line) => line.teamId === defenceMatch[`${side}TeamId`] || line.teamId === key).reduce((sum, line) => sum + line.distanceKm, 0);
    }
  }
  assert.ok(totals.short.passes > totals.counter.passes * 1.12, "short passing must create longer possessions");
  assert.ok(totals.short.completedPasses / totals.short.passes > totals.counter.completedPasses / totals.counter.passes);
  assert.ok(totals.aggressive.pressures > totals.deep.pressures * 1.35);
  assert.ok(totals.aggressive.fouls > totals.deep.fouls);
  assert.ok(totals.aggressive.distance > totals.deep.distance);
});

test("formations create distinct control, attacking, and defensive signatures", () => {
  const shapes = {
    "4-3-3": ["GK", "LB", "CB", "RB", "CM", "LW", "RW", "CB", "CM", "CM", "ST"],
    "4-4-2": ["GK", "LB", "CB", "RB", "CM", "LM", "RM", "CB", "ST", "CM", "ST"],
    "4-2-3-1": ["GK", "LB", "CB", "RB", "CDM", "CAM", "CAM", "CB", "CAM", "CDM", "ST"],
    "3-5-2": ["GK", "CB", "CB", "CB", "CAM", "LM", "RM", "CDM", "CDM", "ST", "ST"],
    "5-3-2": ["GK", "CB", "CB", "CB", "CDM", "LB", "RB", "CM", "CM", "ST", "ST"],
  };
  const totals = Object.fromEntries(Object.keys(shapes).map((formation) => [formation, {
    possession: 0, shots: 0, xg: 0, crosses: 0, concededXg: 0,
  }]));
  for (let index = 0; index < 90; index += 1) {
    for (const [formation, positions] of Object.entries(shapes)) {
      const result = simulateMatch({
        matchId: `formation-${index}`, seed: `formation-${index}`,
        home: makeFormationTeam(`home-${formation}`, 80, formation, positions),
        away: makeFormationTeam("away-433", 80, "4-3-3", shapes["4-3-3"]),
        settings,
      });
      totals[formation].possession += result.teamStats.home.possession;
      totals[formation].shots += result.teamStats.home.shots;
      totals[formation].xg += result.teamStats.home.xg;
      totals[formation].crosses += result.teamStats.home.crosses;
      totals[formation].concededXg += result.teamStats.away.xg;
    }
  }
  assert.ok(totals["4-2-3-1"].possession > totals["4-4-2"].possession + 90,
    `4-2-3-1 control ${totals["4-2-3-1"].possession} vs 4-4-2 ${totals["4-4-2"].possession}`);
  assert.ok(totals["3-5-2"].shots > totals["5-3-2"].shots * 1.02,
    `3-5-2 shots ${totals["3-5-2"].shots} vs 5-3-2 ${totals["5-3-2"].shots}`);
  assert.ok(totals["5-3-2"].concededXg < totals["3-5-2"].concededXg * 0.98,
    `5-3-2 conceded xG ${totals["5-3-2"].concededXg} vs 3-5-2 ${totals["3-5-2"].concededXg}`);
  assert.ok(totals["4-4-2"].crosses > totals["4-2-3-1"].crosses,
    `4-4-2 crosses ${totals["4-4-2"].crosses} vs narrow 4-2-3-1 ${totals["4-2-3-1"].crosses}`);
});

test("goalkeeper movement stays inside realistic keeper-specific bounds", () => {
  for (let index = 0; index < 30; index += 1) {
    const result = simulateMatch({
      matchId: `keeper-movement-${index}`,
      seed: `keeper-movement-${index}`,
      home: makeTeam("home", 80),
      away: makeTeam("away", 80),
      settings: { ...settings, trackingEnabled: true },
    });
    for (const keeper of result.playerStats.filter((line) => line.slotPosition === "GK")) {
      assert.ok(keeper.distanceKm >= 3.5 && keeper.distanceKm <= 6.2, `distance ${keeper.distanceKm}`);
      assert.ok(keeper.highSpeedDistanceKm <= 0.4, `high speed ${keeper.highSpeedDistanceKm}`);
      assert.ok(keeper.sprintDistanceKm <= 0.14, `sprint distance ${keeper.sprintDistanceKm}`);
      assert.ok(keeper.sprintCount <= 4, `sprints ${keeper.sprintCount}`);
      assert.ok(keeper.heatmap.filter((bin) => bin > 0).length <= 8, "keeper heatmap must remain concentrated");
    }
  }
});

test("tracking-derived positions and heatmaps respond to tactical shape", () => {
  let highLineCbX = 0; let deepLineCbX = 0;
  for (let index = 0; index < 20; index += 1) {
    const high = makeTeam("high", 80);
    high.tactic.defensiveApproach = "aggressive";
    high.tactic.lineHeight = 85;
    const deep = makeTeam("deep", 80);
    deep.tactic.defensiveApproach = "deep";
    deep.tactic.lineHeight = 25;
    const opponentA = makeTeam("opponent-a", 80);
    const opponentB = makeTeam("opponent-b", 80);
    const highResult = simulateMatch({ matchId: `shape-high-${index}`, seed: `shape-${index}`, home: high, away: opponentA, settings: { ...settings, trackingEnabled: true } });
    const deepResult = simulateMatch({ matchId: `shape-deep-${index}`, seed: `shape-${index}`, home: deep, away: opponentB, settings: { ...settings, trackingEnabled: true } });
    const highCb = highResult.playerStats.find((line) => line.playerId === "high-2");
    const deepCb = deepResult.playerStats.find((line) => line.playerId === "deep-2");
    highLineCbX += highCb.averagePosition.x;
    deepLineCbX += deepCb.averagePosition.x;
    assert.equal(highCb.heatmap.length, 24);
    assert.equal(deepCb.heatmap.length, 24);
  }
  assert.ok(highLineCbX / 20 > deepLineCbX / 20 + 7, `high ${highLineCbX / 20} vs deep ${deepLineCbX / 20}`);
});

test("sprint speed sets the speed ceiling while acceleration affects repeated high-speed output", () => {
  const home = makeTeam("home", 80);
  Object.assign(home.players[6], { sprintSpeed: 82, acceleration: 96 });
  Object.assign(home.players[7], { sprintSpeed: 82, acceleration: 45 });
  Object.assign(home.players[8], { sprintSpeed: 96, acceleration: 94 });
  Object.assign(home.players[9], { sprintSpeed: 58, acceleration: 58 });
  const totals = new Map(home.players.slice(6, 10).map((player) => [player.playerId, { max: 0, highSpeed: 0, sprints: 0 }]));
  for (let index = 0; index < 35; index += 1) {
    const result = simulateMatch({ matchId: `speed-${index}`, seed: `speed-${index}`, home, away: makeTeam("away", 80), settings });
    for (const line of result.playerStats.filter((player) => totals.has(player.playerId))) {
      const total = totals.get(line.playerId);
      total.max += line.maxSpeedKmh;
      total.highSpeed += line.highSpeedDistanceKm;
      total.sprints += line.sprintCount;
    }
  }
  assert.ok(totals.get("home-8").max > totals.get("home-9").max + 80, "sprint speed must materially raise match maximum speed");
  assert.ok(totals.get("home-6").highSpeed > totals.get("home-7").highSpeed * 1.08, "acceleration must raise repeated high-speed output at equal sprint speed");
  assert.ok(totals.get("home-6").sprints > totals.get("home-7").sprints, "acceleration must raise sprint frequency");
});

test("manual constrained reports recalculate goalkeeper outcomes against the entered score", () => {
  const result = simulateConstrainedMatch({
    matchId: "manual-keeper",
    seed: "manual-keeper",
    home: makeTeam("home", 80),
    away: makeTeam("away", 80),
    settings,
    homeScore: 3,
    awayScore: 1,
  });
  const homeKeeper = result.playerStats.find((line) => line.teamId === "home" && line.slotPosition === "GK");
  const awayKeeper = result.playerStats.find((line) => line.teamId === "away" && line.slotPosition === "GK");
  assert.equal(homeKeeper.goalsConceded, 1);
  assert.equal(awayKeeper.goalsConceded, 3);
  assert.equal(homeKeeper.shotsFaced, homeKeeper.saves + 1);
  assert.equal(awayKeeper.shotsFaced, awayKeeper.saves + 3);
  assert.equal(result.teamStats.home.goalsPrevented, homeKeeper.goalsPrevented);
  assert.equal(result.teamStats.away.goalsPrevented, awayKeeper.goalsPrevented);
});

test("ratings stay centered and positionally fair across a calibrated sample", () => {
  const groups = { GK: [], DEF: [], MID: [], ATT: [] };
  let ninePlus = 0; let total = 0;
  for (let index = 0; index < 120; index += 1) {
    const result = simulateMatch({ matchId: `ratings-${index}`, seed: `ratings-${index}`, home: makeTeam("home", 80), away: makeTeam("away", 80), settings });
    for (const line of result.playerStats.filter((player) => player.minutes >= 15)) {
      const group = line.slotPosition === "GK" ? "GK"
        : ["CB", "LB", "RB", "LWB", "RWB"].includes(line.slotPosition) ? "DEF"
          : ["CDM", "CM", "CAM", "LM", "RM"].includes(line.slotPosition) ? "MID" : "ATT";
      groups[group].push(line.rating);
      if (line.rating >= 9) ninePlus += 1;
      total += 1;
    }
  }
  const groupMeans = Object.fromEntries(Object.entries(groups).map(([group, ratings]) => [group, averageForTest(ratings, (rating) => rating)]));
  for (const [group, mean] of Object.entries(groupMeans)) assert.ok(mean >= 6.35 && mean <= 7.15, `${group} mean ${mean}`);
  assert.ok(Math.max(...Object.values(groupMeans)) - Math.min(...Object.values(groupMeans)) < 0.45, JSON.stringify(groupMeans));
  assert.ok(ninePlus / total < 0.015, `9+ frequency ${(ninePlus / total * 100).toFixed(2)}%`);
});

test("match-level distributions remain within football-plausible ranges", () => {
  const totals = { teams: 0, shots: 0, passes: 0, completedPasses: 0, fouls: 0, cards: 0, offsides: 0, xg: 0, interceptions: 0, recoveries: 0 };
  for (let index = 0; index < 140; index += 1) {
    const result = simulateMatch({ matchId: `plausibility-${index}`, seed: `plausibility-${index}`, home: makeTeam("home", 80), away: makeTeam("away", 80), settings });
    for (const side of ["home", "away"]) {
      const team = result.teamStats[side];
      totals.teams += 1; totals.shots += team.shots; totals.passes += team.passes;
      totals.completedPasses += team.completedPasses; totals.fouls += team.fouls;
      totals.cards += team.yellowCards + team.redCards; totals.offsides += team.offsides; totals.xg += team.xg;
      totals.interceptions += team.interceptions; totals.recoveries += team.recoveries;
      assert.ok(team.shotsOnTarget <= team.shots);
      assert.ok(team.completedPasses <= team.passes);
      assert.ok(team.completedCrosses <= team.crosses);
      assert.ok(team.duelsWon <= team.duels);
      assert.ok(team.aerialDuelsWon <= team.aerialDuels);
    }
  }
  const mean = (key) => totals[key] / totals.teams;
  const passAccuracy = totals.completedPasses / totals.passes;
  assert.ok(mean("shots") >= 7 && mean("shots") <= 18, `shots ${mean("shots")}`);
  assert.ok(mean("passes") >= 260 && mean("passes") <= 480, `passes ${mean("passes")}`);
  assert.ok(passAccuracy >= 0.68 && passAccuracy <= 0.9, `pass accuracy ${passAccuracy}`);
  assert.ok(mean("fouls") >= 6 && mean("fouls") <= 18, `fouls ${mean("fouls")}`);
  assert.ok(mean("cards") >= 0.8 && mean("cards") <= 4, `cards ${mean("cards")}`);
  assert.ok(mean("offsides") >= 0.4 && mean("offsides") <= 4, `offsides ${mean("offsides")}`);
  assert.ok(mean("xg") >= 0.7 && mean("xg") <= 2.8, `xG ${mean("xg")}`);
  assert.ok(mean("interceptions") >= 8 && mean("interceptions") <= 24, `interceptions ${mean("interceptions")}`);
  assert.ok(mean("recoveries") >= 20 && mean("recoveries") <= 65, `recoveries ${mean("recoveries")}`);
});

function averageForTest(items, select) {
  return items.reduce((sum, item) => sum + select(item), 0) / items.length;
}

test("scoreline equals persisted goal events and team statistics remain coherent", () => {
  const result = simulateMatch({ matchId: "m2", seed: "seed-2", home: makeTeam("home", 82), away: makeTeam("away", 78), settings });
  const goals = result.events.filter((event) => ["goal", "penalty_goal", "own_goal"].includes(event.type));
  assert.equal(result.homeScore, goals.filter((event) => event.teamId === "home").length);
  assert.equal(result.awayScore, goals.filter((event) => event.teamId === "away").length);
  assert.equal(result.teamStats.home.possession + result.teamStats.away.possession, 100);
  assert.ok(result.teamStats.home.shotsOnTarget <= result.teamStats.home.shots);
  assert.ok(result.teamStats.away.shotsOnTarget <= result.teamStats.away.shots);
  assert.ok(result.playerStats.every((player) => player.rating >= 1 && player.rating <= 10));
  for (const teamId of ["home", "away"]) {
    const lines = result.playerStats.filter((line) => line.teamId === teamId);
    assert.equal(lines.reduce((sum, line) => sum + line.passes, 0), result.teamStats[teamId].passes);
    assert.equal(lines.reduce((sum, line) => sum + line.completedPasses, 0), result.teamStats[teamId].completedPasses);
    assert.ok(lines.some((line) => line.tackles + line.interceptions > 0), "defensive work should be attributed to players");
  }
  assert.ok(result.playerStats.every((line) => line.minutes > 0), "unused substitutes must not create season appearances");
});

test("higher-rated teams earn more points across a large seeded sample", () => {
  let strongPoints = 0;
  for (let index = 0; index < 250; index += 1) {
    const result = simulateMatch({ matchId: `quality-${index}`, seed: `quality-${index}`, home: makeTeam("strong", 86), away: makeTeam("weak", 74), settings });
    strongPoints += result.homeScore > result.awayScore ? 3 : result.homeScore === result.awayScore ? 1 : 0;
  }
  assert.ok(strongPoints > 500, `expected clear quality advantage, received ${strongPoints} points`);
});

test("counter attacks create more threat against a high line than a deep line", () => {
  let highLineXg = 0;
  let deepLineXg = 0;
  for (let index = 0; index < 150; index += 1) {
    const counter = makeTeam("counter", 80);
    counter.tactic.buildUpStyle = "counter";
    const high = makeTeam("high", 80);
    high.tactic.defensiveApproach = "high";
    high.tactic.lineHeight = 85;
    const deep = makeTeam("deep", 80);
    deep.tactic.defensiveApproach = "deep";
    deep.tactic.lineHeight = 20;
    highLineXg += simulateMatch({ matchId: `high-${index}`, seed: `matchup-${index}`, home: counter, away: high, settings }).teamStats.home.xg;
    deepLineXg += simulateMatch({ matchId: `deep-${index}`, seed: `matchup-${index}`, home: counter, away: deep, settings }).teamStats.home.xg;
  }
  assert.ok(highLineXg > deepLineXg * 1.08, `${highLineXg} should exceed ${deepLineXg}`);
});

test("substitutions use eligible bench players and produce coherent minutes", () => {
  const result = simulateMatch({ matchId: "subs", seed: "subs-seed", home: makeTeam("home", 80), away: makeTeam("away", 80), settings });
  const substitutions = result.events.filter((event) => event.type === "substitution");
  assert.ok(substitutions.length > 0 && substitutions.length <= 10);
  for (const event of substitutions) {
    assert.match(event.playerId, /-bench-/);
    assert.ok(event.secondaryPlayerId && !event.secondaryPlayerId.includes("-bench-"));
    const entrant = result.playerStats.find((line) => line.playerId === event.playerId);
    const departing = result.playerStats.find((line) => line.playerId === event.secondaryPlayerId);
    assert.equal(entrant.minutes, 90 - event.minute);
    assert.equal(departing.minutes, event.minute);
  }
  assert.ok(result.playerStats.filter((line) => line.starter).every((line) => line.role && line.focus), "starters must retain their tactical assignment in the match record");
});

test("high-frequency samples generate bounded cards and injuries from active players", () => {
  let injuries = 0;
  let cards = 0;
  const eventSettings = { ...settings, injuryFrequency: 100, disciplineFrequency: 100 };
  for (let index = 0; index < 100; index += 1) {
    const result = simulateMatch({ matchId: `events-${index}`, seed: `events-${index}`, home: makeTeam("home", 78), away: makeTeam("away", 78), settings: eventSettings });
    injuries += result.events.filter((event) => event.type === "injury").length;
    cards += result.events.filter((event) => ["yellow_card", "red_card"].includes(event.type)).length;
    assert.ok(result.events.filter((event) => event.type === "substitution").length <= 10);
    assert.ok(result.playerStats.every((line) => line.yellowCards <= 1), "yellow accumulation counts matches, not multiple cards in one match");
    for (const dismissal of result.events.filter((event) => event.type === "red_card")) {
      const laterInvolvement = result.events.find((event) => event.minute > dismissal.minute
        && (event.playerId === dismissal.playerId || event.secondaryPlayerId === dismissal.playerId));
      assert.equal(laterInvolvement, undefined, "a dismissed player cannot participate in later events");
    }
  }
  assert.ok(injuries > 0, "expected injuries across 100 matches");
  assert.ok(cards > injuries, "cards should remain more common than injuries");
});

test("variance slider changes scoreline dispersion without changing determinism", () => {
  const lowDiffs = [];
  const highDiffs = [];
  for (let seed = 0; seed < 500; seed += 1) {
    lowDiffs.push(simulateMatch({ matchId: `variance-${seed}`, seed: `${seed}`, home: makeTeam("h", 78), away: makeTeam("a", 78), settings: { ...settings, variance: 20 } }).homeScore
      - simulateMatch({ matchId: `variance-${seed}`, seed: `${seed}`, home: makeTeam("h", 78), away: makeTeam("a", 78), settings: { ...settings, variance: 20 } }).awayScore);
    const high = simulateMatch({ matchId: `variance-${seed}`, seed: `${seed}`, home: makeTeam("h", 78), away: makeTeam("a", 78), settings: { ...settings, variance: 80 } });
    highDiffs.push(high.homeScore - high.awayScore);
  }
  const spread = (values) => values.reduce((sum, value) => sum + value * value, 0) / values.length;
  assert.ok(spread(highDiffs) > spread(lowDiffs) * 1.08, `expected high variance spread ${spread(highDiffs)} > low ${spread(lowDiffs)}`);
});

test("FOG creates more four-point underdog upsets without granting a fixed advantage", () => {
  let fogOffUpsets = 0;
  let fogOnUpsets = 0;
  let fogOffGoalDiff = 0;
  let fogOnGoalDiff = 0;
  for (let seed = 0; seed < 800; seed += 1) {
    const base = { matchId: `fog-${seed}`, seed: `${seed}`, home: makeTeam("favorite", 82), away: makeTeam("underdog", 78) };
    const off = simulateMatch({ ...base, settings: { ...settings, fogStrength: 0 } });
    const on = simulateMatch({ ...base, settings: { ...settings, fogStrength: 80 } });
    fogOffUpsets += off.awayScore > off.homeScore ? 1 : 0;
    fogOnUpsets += on.awayScore > on.homeScore ? 1 : 0;
    fogOffGoalDiff += off.awayScore - off.homeScore;
    fogOnGoalDiff += on.awayScore - on.homeScore;
  }
  assert.ok(fogOnUpsets > fogOffUpsets, `expected FOG upsets ${fogOnUpsets} > ${fogOffUpsets}`);
  assert.ok(fogOnGoalDiff < 0, "FOG must not turn the underdog into the favorite on average");
});

test("accumulated fatigue reduces team performance only when fatigue impact is enabled", () => {
  let freshXg = 0;
  let tiredXg = 0;
  let ignoredTiredXg = 0;
  for (let seed = 0; seed < 400; seed += 1) {
    const fresh = makeTeam("fresh", 80);
    const tired = makeTeam("tired", 80);
    tired.players = tired.players.map((player) => ({ ...player, fatigue: 85 }));
    const opponent = makeTeam("opponent", 80);
    freshXg += simulateMatch({ matchId: `fatigue-${seed}`, seed: `${seed}`, home: fresh, away: opponent, settings: { ...settings, fatigueEffect: 100 } }).teamStats.home.xg;
    tiredXg += simulateMatch({ matchId: `fatigue-${seed}`, seed: `${seed}`, home: tired, away: opponent, settings: { ...settings, fatigueEffect: 100 } }).teamStats.home.xg;
    ignoredTiredXg += simulateMatch({ matchId: `fatigue-${seed}`, seed: `${seed}`, home: tired, away: opponent, settings: { ...settings, fatigueEffect: 0 } }).teamStats.home.xg;
  }
  assert.ok(freshXg > tiredXg * 1.15, `fresh xG ${freshXg} should exceed tired ${tiredXg}`);
  assert.equal(ignoredTiredXg, freshXg, "fatigueEffect 0 must fully disable the penalty");
});

test("role familiarity changes tactical execution without changing stored OVR", () => {
  let naturalXg = 0;
  let unfamiliarXg = 0;
  for (let seed = 0; seed < 300; seed += 1) {
    const natural = makeTeam("natural", 80);
    natural.players = natural.players.map((player) => ({ ...player, positions: player.position }));
    const unfamiliar = makeTeam("unfamiliar", 80);
    unfamiliar.players = unfamiliar.players.map((player) => ({ ...player, positions: player.position === "GK" ? "GK" : "ST" }));
    const opponent = makeTeam("opponent", 80);
    naturalXg += simulateMatch({ matchId: `fit-${seed}`, seed: `${seed}`, home: natural, away: opponent, settings }).teamStats.home.xg;
    unfamiliarXg += simulateMatch({ matchId: `fit-${seed}`, seed: `${seed}`, home: unfamiliar, away: opponent, settings }).teamStats.home.xg;
  }
  assert.ok(naturalXg > unfamiliarXg * 1.08, `natural fit ${naturalXg} should exceed unfamiliar ${unfamiliarXg}`);
});

test("goalkeeper and outfield slot mismatches receive a severe execution and rating penalty", () => {
  const broken = makeTeam("broken", 80);
  const goalkeeperAssignment = broken.tactic.assignments[0];
  const centreBackAssignment = broken.tactic.assignments[2];
  [goalkeeperAssignment.playerId, centreBackAssignment.playerId] = [centreBackAssignment.playerId, goalkeeperAssignment.playerId];
  const result = simulateMatch({ matchId: "keeper-mismatch", seed: "keeper-mismatch", home: broken, away: makeTeam("away", 80), settings });
  const goalkeeperAtCentreBack = result.playerStats.find((line) => line.playerId === "broken-0");
  assert.equal(goalkeeperAtCentreBack.slotPosition, "CB");
  assert.ok(goalkeeperAtCentreBack.rating <= 4, `mismatched goalkeeper rating was ${goalkeeperAtCentreBack.rating}`);
  assert.ok(goalkeeperAtCentreBack.interceptions + goalkeeperAtCentreBack.tackles <= 2,
    "a goalkeeper at centre-back must not produce normal defender output");
});

test("v2 analytics expose adaptive tracking and reconciled advanced totals", () => {
  const result = simulateMatch({ matchId: "analytics", seed: "analytics-seed", home: makeTeam("home", 82), away: makeTeam("away", 79), settings: { ...settings, trackingEnabled: true } });
  assert.equal(result.engineVersion, "fc25-il-2");
  assert.equal(result.calibrationVersion, "sofascore-v1");
  assert.ok(result.tracking.chunks.length > 0);
  assert.ok(result.tracking.chunks.every((chunk) => chunk.frames.every((frame) => [1, 2, 3, 4, 5].includes(frame.deltaSeconds))));
  assert.ok(result.tracking.chunks.some((chunk) => chunk.frames.some((frame) => frame.deltaSeconds === 1)));

  for (const side of ["home", "away"]) {
    const team = result.teamStats[side];
    const lines = result.playerStats.filter((line) => line.teamId === (side === "home" ? "home" : "away"));
    for (const [teamKey, playerKey] of [
      ["shots", "shots"], ["shotsOnTarget", "shotsOnTarget"], ["passes", "passes"],
      ["completedPasses", "completedPasses"], ["keyPasses", "keyPasses"],
      ["tackles", "tackles"], ["interceptions", "interceptions"], ["recoveries", "recoveries"],
      ["fouls", "fouls"], ["yellowCards", "yellowCards"], ["redCards", "redCards"],
    ]) {
      assert.equal(lines.reduce((sum, line) => sum + line[playerKey], 0), team[teamKey], `${side} ${teamKey} must reconcile`);
    }
    assert.ok(team.xgot <= team.shotsOnTarget + 0.001);
    assert.ok(team.fieldTilt >= 0 && team.fieldTilt <= 100);
  }
});

test("player analytics include maps, physical output, and rating components", () => {
  const result = simulateMatch({ matchId: "player-detail", seed: "player-detail-seed", home: makeTeam("home", 80), away: makeTeam("away", 80), settings: { ...settings, trackingEnabled: true } });
  for (const line of result.playerStats) {
    assert.ok(Array.isArray(line.heatmap) && line.heatmap.length === 24);
    assert.ok(Array.isArray(line.shotMap));
    assert.ok(Array.isArray(line.passMap));
    assert.ok(line.distanceKm > 0);
    assert.ok(line.maxSpeedKmh > 0);
    assert.ok(line.ratingComponents && typeof line.ratingComponents.base === "number");
  }
  const averageRating = result.playerStats.reduce((sum, line) => sum + line.rating, 0) / result.playerStats.length;
  assert.ok(averageRating >= 6.35 && averageRating <= 7.15, `expected Sofascore-like center, received ${averageRating}`);
});

test("aggressive pressing produces more fouls than a deep conservative block", () => {
  let aggressiveFouls = 0;
  let deepFouls = 0;
  for (let index = 0; index < 250; index += 1) {
    const aggressive = makeTeam("aggressive", 80);
    aggressive.tactic.defensiveApproach = "aggressive";
    aggressive.tactic.lineHeight = 85;
    const deep = makeTeam("deep", 80);
    deep.tactic.defensiveApproach = "deep";
    deep.tactic.lineHeight = 20;
    const opponent = makeTeam("opponent", 80);
    aggressiveFouls += simulateMatch({ matchId: `press-${index}`, seed: `${index}`, home: aggressive, away: opponent, settings }).teamStats.home.fouls;
    deepFouls += simulateMatch({ matchId: `block-${index}`, seed: `${index}`, home: deep, away: opponent, settings }).teamStats.home.fouls;
  }
  assert.ok(aggressiveFouls > deepFouls * 1.15, `${aggressiveFouls} should exceed ${deepFouls}`);
});

test("interceptions and recoveries are owned by tactically plausible positions", () => {
  const totals = { DEF: { interceptions: 0, recoveries: 0, players: 0 }, ATT: { interceptions: 0, recoveries: 0, players: 0 } };
  for (let index = 0; index < 120; index += 1) {
    const result = simulateMatch({ matchId: `ownership-${index}`, seed: `ownership-${index}`, home: makeTeam("home", 80), away: makeTeam("away", 80), settings });
    for (const line of result.playerStats.filter((player) => player.minutes >= 60)) {
      const group = ["CB", "LB", "RB", "LWB", "RWB", "CDM"].includes(line.slotPosition) ? "DEF"
        : ["LW", "RW", "CF", "ST"].includes(line.slotPosition) ? "ATT" : null;
      if (!group) continue;
      totals[group].players += 1;
      totals[group].interceptions += line.interceptions;
      totals[group].recoveries += line.recoveries;
    }
  }
  const perPlayer = (group, field) => totals[group][field] / totals[group].players;
  assert.ok(perPlayer("ATT", "interceptions") < perPlayer("DEF", "interceptions") * 0.55,
    `attackers ${perPlayer("ATT", "interceptions")} interceptions should trail defenders ${perPlayer("DEF", "interceptions")}`);
  assert.ok(perPlayer("ATT", "recoveries") < perPlayer("DEF", "recoveries") * 0.7,
    `attackers ${perPlayer("ATT", "recoveries")} recoveries should trail defenders ${perPlayer("DEF", "recoveries")}`);
});

test("manual constrained analytics exactly honor the entered scoreline", () => {
  const result = simulateConstrainedMatch({
    matchId: "manual", seed: "manual-seed", home: makeTeam("home", 80), away: makeTeam("away", 80),
    settings: { ...settings, trackingEnabled: true }, homeScore: 4, awayScore: 3,
  });
  assert.equal(result.homeScore, 4);
  assert.equal(result.awayScore, 3);
  assert.equal(result.source, "manual_constrained");
  assert.equal(result.playerStats.reduce((sum, line) => sum + line.goals, 0), 7);
  assert.equal(result.events.filter((event) => event.type === "goal").length, 7);
});
