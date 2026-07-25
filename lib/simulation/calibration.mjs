import { simulateMatch } from "./engine.mjs";
import { applySimulationPreset } from "./settings.mjs";

const positions = ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CM", "LW", "RW", "ST"];
const roles = [
  ["goalkeeper", "defend"], ["fullback", "defend"], ["defender", "defend"], ["defender", "defend"], ["fullback", "defend"],
  ["holding", "defend"], ["box_to_box", "balanced"], ["playmaker", "roaming"], ["inside_forward", "attack"], ["winger", "attack"], ["advanced_forward", "complete"],
];

function player(teamId, index, rating, bench = false) {
  const position = positions[Math.min(index, positions.length - 1)];
  const value = (offset = 0) => Math.max(1, Math.min(99, rating + offset));
  return {
    playerId: `${teamId}-${bench ? "b" : "s"}-${index}`, name: `${teamId} ${index}`, position, rating,
    finishing: value(position === "ST" ? 5 : -8), headingAccuracy: value(), longShots: value(-4), shortPassing: value(), longPassing: value(),
    vision: value(), crossing: value(), ballControl: value(), composure: value(), positioning: value(), acceleration: value(), sprintSpeed: value(),
    stamina: value(), aggression: value(), interceptions: value(), defensiveAwareness: value(), standingTackle: value(),
    gkDiving: position === "GK" ? value() : 10, gkHandling: position === "GK" ? value() : 10,
    gkPositioning: position === "GK" ? value() : 10, gkReflexes: position === "GK" ? value() : 10, fatigue: 0,
  };
}

function team(index, rating) {
  const id = `cal-${index}`;
  const players = positions.map((_, playerIndex) => player(id, playerIndex, rating));
  const bench = Array.from({ length: 7 }, (_, playerIndex) => ({ ...player(id, Math.min(playerIndex + 1, 10), rating - 2, true) }));
  return { id, name: `Calibration ${rating}`, rating, players, bench, tactic: {
    formation: "4-3-3", buildUpStyle: index % 3 === 0 ? "counter" : index % 3 === 1 ? "short_passing" : "balanced",
    defensiveApproach: index % 4 === 0 ? "high" : "balanced", lineHeight: index % 4 === 0 ? 72 : 50,
    assignments: roles.map(([role, focus], slotIndex) => ({ slotIndex, slotPosition: positions[slotIndex], playerId: players[slotIndex].playerId, role, focus })),
  } };
}

const round = (value, places = 4) => Number(value.toFixed(places));
function correlation(xs, ys) {
  const xMean = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const yMean = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  let numerator = 0; let xSpread = 0; let ySpread = 0;
  for (let index = 0; index < xs.length; index += 1) {
    const x = xs[index] - xMean; const y = ys[index] - yMean;
    numerator += x * y; xSpread += x * x; ySpread += y * y;
  }
  return numerator / Math.sqrt(xSpread * ySpread);
}

export function runCalibration({ seasons = 20, seed = "balanced", settings = applySimulationPreset("balanced") } = {}) {
  const teams = [72, 74, 76, 78, 80, 82, 84, 86].map((rating, index) => team(index, rating));
  const points = new Map(teams.map((entry) => [entry.id, 0]));
  const ratingObservations = [];
  const pointObservations = [];
  let matches = 0; let goals = 0; let homeWins = 0; let awayWins = 0; let draws = 0; let injuries = 0; let cards = 0;
  const invariants = { goalEventMismatch: 0, possessionMismatch: 0 };
  for (let season = 1; season <= seasons; season += 1) {
    const seasonPoints = new Map(teams.map((entry) => [entry.id, 0]));
    for (let homeIndex = 0; homeIndex < teams.length; homeIndex += 1) {
      for (let awayIndex = 0; awayIndex < teams.length; awayIndex += 1) {
        if (homeIndex === awayIndex) continue;
        const home = teams[homeIndex]; const away = teams[awayIndex];
        const result = simulateMatch({ matchId: `${season}-${home.id}-${away.id}`, seed: `${seed}:${season}:${home.id}:${away.id}`, home, away, settings });
        matches += 1; goals += result.homeScore + result.awayScore;
        if (result.homeScore > result.awayScore) { homeWins += 1; points.set(home.id, points.get(home.id) + 3); seasonPoints.set(home.id, seasonPoints.get(home.id) + 3); }
        else if (result.homeScore < result.awayScore) { awayWins += 1; points.set(away.id, points.get(away.id) + 3); seasonPoints.set(away.id, seasonPoints.get(away.id) + 3); }
        else { draws += 1; points.set(home.id, points.get(home.id) + 1); points.set(away.id, points.get(away.id) + 1); seasonPoints.set(home.id, seasonPoints.get(home.id) + 1); seasonPoints.set(away.id, seasonPoints.get(away.id) + 1); }
        const goalEvents = result.events.filter((event) => event.type === "goal").length;
        if (goalEvents !== result.homeScore + result.awayScore) invariants.goalEventMismatch += 1;
        if (result.teamStats.home.possession + result.teamStats.away.possession !== 100) invariants.possessionMismatch += 1;
        injuries += result.events.filter((event) => event.type === "injury").length;
        cards += result.events.filter((event) => event.type === "yellow_card" || event.type === "red_card").length;
      }
    }
    for (const entry of teams) { ratingObservations.push(entry.rating); pointObservations.push(seasonPoints.get(entry.id)); }
  }
  return {
    engineVersion: "fc25-il-1", seed, seasons, matches,
    goalsPerMatch: round(goals / matches), homeWinRate: round(homeWins / matches), drawRate: round(draws / matches), awayWinRate: round(awayWins / matches),
    injuriesPerMatch: round(injuries / matches), cardsPerMatch: round(cards / matches),
    ratingPointsCorrelation: round(correlation(ratingObservations, pointObservations)),
    pointsPerTeamPerSeason: Object.fromEntries(teams.map((entry) => [entry.rating, round(points.get(entry.id) / seasons, 2)])),
    invariants,
  };
}
