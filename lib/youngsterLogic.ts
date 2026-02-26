/**
 * Youngster upgrade logic (IL25 spec - from Google Sheet)
 * https://docs.google.com/spreadsheets/d/1sfdtZPyceXVmi2oSgAT-da9fqmXBwdx4d7eVRDY8XRA
 *
 * Upgrade based on: OVR band, games played, adjusted average (match rating)
 * Min 8 games for avg-based upgrade
 */

export type OVRBand = "≤69" | "70-74" | "75-79" | "80-84" | "85-89" | "90+";

const GAMES_UPGRADE: Record<OVRBand, Record<string, number>> = {
  "≤69": {
    "14+": 2,
    "12-13": 1,
    "8-11": 0,
    "6-7": -1,
    "≤5": -2,
  },
  "70-74": {
    "14+": 1,
    "8-13": 0,
    "6-7": -1,
    "≤5": -2,
  },
  "75-79": {
    "14+": 1,
    "8-13": 0,
    "6-7": -1,
    "≤5": -2,
  },
  "80-84": {
    "15+": 1,
    "11-14": 0,
    "8-10": -1,
    "6-7": -2,
    "≤5": -3,
  },
  "85-89": {
    "12+": 0,
    "9-11": -1,
    "6-8": -2,
    "≤5": -3,
  },
  "90+": {
    "12+": 0,
    "9-11": -1,
    "6-8": -2,
    "≤5": -3,
  },
};

const AVG_UPGRADE: Record<OVRBand, Record<string, number>> = {
  "≤69": {
    "7.0+": 4,
    "6.6-6.9": 3,
    "6.2-6.5": 2,
    "5.8-6.1": 1,
    "5.6-5.7": 0,
    "5.2-5.5": -1,
    "≤5.1": -2,
  },
  "70-74": {
    "7.1+": 4,
    "6.7-7.0": 3,
    "6.3-6.6": 2,
    "5.9-6.2": 1,
    "5.7-5.8": 0,
    "5.3-5.6": -1,
    "≤5.2": -2,
  },
  "75-79": {
    "7.2+": 4,
    "6.8-7.1": 3,
    "6.4-6.7": 2,
    "6.0-6.3": 1,
    "5.8-5.9": 0,
    "5.4-5.7": -1,
    "≤5.3": -2,
  },
  "80-84": {
    "7.2+": 3,
    "6.8-7.1": 2,
    "6.4-6.7": 1,
    "6.0-6.3": 0,
    "5.6-5.9": -1,
    "5.2-5.5": -2,
    "≤5.1": -3,
  },
  "85-89": {
    "7.4+": 3,
    "7.0-7.3": 2,
    "6.6-6.9": 1,
    "6.2-6.5": 0,
    "5.8-6.1": -1,
    "5.4-5.7": -2,
    "≤5.3": -3,
  },
  "90+": {
    "7.4+": 2,
    "7.0-7.3": 1,
    "6.6-6.9": 0,
    "6.2-6.5": -1,
    "5.8-6.1": -2,
    "5.4-5.7": -3,
    "≤5.3": -4,
  },
};

function getOVRBand(rating: number): OVRBand {
  if (rating <= 69) return "≤69";
  if (rating <= 74) return "70-74";
  if (rating <= 79) return "75-79";
  if (rating <= 84) return "80-84";
  if (rating <= 89) return "85-89";
  return "90+";
}

function getGamesBucket(games: number, band: OVRBand): string {
  if (band === "80-84") {
    if (games >= 15) return "15+";
    if (games >= 11) return "11-14";
    if (games >= 8) return "8-10";
    if (games >= 6) return "6-7";
    return "≤5";
  }
  if (band === "85-89" || band === "90+") {
    if (games >= 12) return "12+";
    if (games >= 9) return "9-11";
    if (games >= 6) return "6-8";
    return "≤5";
  }
  if (games >= 14) return "14+";
  if (games >= 12) return "12-13";
  if (band === "≤69" && games >= 8) return "8-11";
  if ((band === "70-74" || band === "75-79") && games >= 8) return "8-13";
  if (games >= 6) return "6-7";
  return "≤5";
}

function getAvgBucket(avg: number, band: OVRBand): string {
  const ranges: [number, string][] = (() => {
    if (band === "≤69") return [[7.0,"7.0+"],[6.6,"6.6-6.9"],[6.2,"6.2-6.5"],[5.8,"5.8-6.1"],[5.6,"5.6-5.7"],[5.2,"5.2-5.5"],[0,"≤5.1"]];
    if (band === "70-74" || band === "75-79") return [[7.1,"7.1+"],[6.7,"6.7-7.0"],[6.3,"6.3-6.6"],[5.9,"5.9-6.2"],[5.7,"5.7-5.8"],[5.3,"5.3-5.6"],[0,"≤5.2"]];
    if (band === "80-84") return [[7.2,"7.2+"],[6.8,"6.8-7.1"],[6.4,"6.4-6.7"],[6.0,"6.0-6.3"],[5.6,"5.6-5.9"],[5.2,"5.2-5.5"],[0,"≤5.1"]];
    return [[7.4,"7.4+"],[7.0,"7.0-7.3"],[6.6,"6.6-6.9"],[6.2,"6.2-6.5"],[5.8,"5.8-6.1"],[5.4,"5.4-5.7"],[0,"≤5.3"]];
  })();
  for (const [min, key] of ranges) {
    if (avg >= min) return key;
  }
  return "≤5.1";
}

/** Games-based upgrade (uses OVR at start of season) */
export function getGamesUpgrade(rating: number, games: number): number {
  const band = getOVRBand(rating);
  const bucket = getGamesBucket(games, band);
  const table = GAMES_UPGRADE[band];
  return table[bucket] ?? 0;
}

/** Avg-based upgrade (min 8 games; uses OVR at start of season) */
export function getAvgUpgrade(rating: number, adjAvg: number, games: number): number {
  if (games < 8) return 0;
  const band = getOVRBand(rating);
  const bucket = getAvgBucket(adjAvg, band);
  const table = AVG_UPGRADE[band];
  return table[bucket] ?? 0;
}

/** Total upgrade = max(games_upgrade, avg_upgrade) per sheet logic */
export function getYoungsterUpgrade(
  rating: number,
  games: number,
  adjAvg: number
): number {
  const gamesUp = getGamesUpgrade(rating, games);
  const avgUp = getAvgUpgrade(rating, adjAvg, games);
  return Math.max(gamesUp, avgUp);
}
