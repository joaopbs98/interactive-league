export const wageTable: Record<number, { def: number; att: number }> = {
  95: { def: 48_000_000, att: 60_000_000 },
  94: { def: 48_000_000, att: 60_000_000 },
  93: { def: 44_800_000, att: 56_000_000 },
  92: { def: 41_600_000, att: 52_000_000 },
  91: { def: 38_400_000, att: 48_000_000 },
  90: { def: 35_200_000, att: 44_000_000 },
  89: { def: 32_000_000, att: 40_000_000 },
  88: { def: 28_800_000, att: 36_000_000 },
  87: { def: 25_600_000, att: 32_000_000 },
  86: { def: 22_400_000, att: 28_000_000 },
  85: { def: 19_200_000, att: 24_000_000 },
  84: { def: 16_000_000, att: 20_000_000 },
  83: { def: 14_400_000, att: 18_000_000 },
  82: { def: 12_800_000, att: 16_000_000 },
  81: { def: 11_200_000, att: 14_000_000 },
  80: { def: 10_400_000, att: 13_000_000 },
  79: { def: 9_600_000, att: 12_000_000 },
  78: { def: 8_800_000, att: 11_000_000 },
  77: { def: 8_000_000, att: 10_000_000 },
  76: { def: 7_200_000, att: 9_000_000 },
  75: { def: 6_400_000, att: 8_000_000 },
  74: { def: 5_800_000, att: 7_200_000 },
  73: { def: 5_100_000, att: 6_400_000 },
  72: { def: 4_500_000, att: 5_600_000 },
  71: { def: 3_800_000, att: 4_800_000 },
  70: { def: 3_200_000, att: 4_000_000 },
  69: { def: 2_900_000, att: 3_600_000 },
  68: { def: 2_600_000, att: 3_200_000 },
  67: { def: 2_200_000, att: 2_800_000 },
  66: { def: 1_900_000, att: 2_400_000 },
  65: { def: 1_600_000, att: 2_000_000 },
  64: { def: 1_440_000, att: 1_800_000 },
  63: { def: 1_280_000, att: 1_600_000 },
  62: { def: 1_120_000, att: 1_400_000 },
  61: { def: 960_000, att: 1_200_000 },
  60: { def: 800_000, att: 1_000_000 },
  59: { def: 800_000, att: 1_000_000 },
  58: { def: 800_000, att: 1_000_000 },
  57: { def: 800_000, att: 1_000_000 },
  56: { def: 800_000, att: 1_000_000 },
  55: { def: 800_000, att: 1_000_000 },
  54: { def: 800_000, att: 1_000_000 },
  53: { def: 800_000, att: 1_000_000 },
};

function parsePrimaryPosition(posCsv: string): string {
  return posCsv.split(",")[0].trim().toUpperCase();
}

export function getWageFromCsv(rating: number, posCsv: string): number {
  const primary = parsePrimaryPosition(posCsv);
  return getAnnualWage(rating, primary);
}

function isDefender(position: string): boolean {
  return ["GK", "CB", "LB", "RB", "LWB", "RWB", "CDM"].includes(
    position.toUpperCase()
  );
}

export function getAnnualWage(rating: number, position: string): number {
  const entry = wageTable[rating];
  if (!entry) {
    return isDefender(position) ? wageTable[60].def : wageTable[60].att;
  }
  return isDefender(position) ? entry.def : entry.att;
}
