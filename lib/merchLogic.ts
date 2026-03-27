/**
 * Merchandise revenue logic (IL25 spec - Excel formula)
 * - Only top 14 players by OVR grant merchandise revenue
 * - Excel: =ARRED((G^1.7*1000000)*SE(E="DEF",0.6,1),-5)
 * - G = Int. Rep (1-5), E = ATT/DEF. ROUND to -5 = nearest 100000
 * - Teams receive merch_pct (30% base + draft bonuses)
 */

const DEF_POSITIONS = ["GK", "CB", "LB", "RB", "LWB", "RWB", "CDM"];

export type MerchPlayer = {
  player_id: string;
  rating: number;
  positions: string;
  international_reputation?: string | number | null;
};

function parseIR(ir: string | number | null | undefined): number {
  if (ir == null) return 1;
  const n = typeof ir === "string" ? parseInt(ir, 10) : ir;
  return Math.min(5, Math.max(1, isNaN(n) ? 1 : n));
}

function isDef(positions: string): boolean {
  const first = (positions || "").split(",")[0]?.trim().toUpperCase() || "";
  return DEF_POSITIONS.includes(first);
}

/**
 * Per-player merchandise value (Excel formula)
 * (IR^1.7 * 1M) * (0.6 if DEF, 1 if ATT), rounded to nearest 100000
 */
export function playerMerchValue(player: MerchPlayer): number {
  const ir = parseIR(player.international_reputation);
  const posMult = isDef(player.positions) ? 0.6 : 1;
  const raw = Math.pow(ir, 1.7) * 1_000_000 * posMult;
  return Math.round(raw / 100_000) * 100_000;
}

/**
 * Compute team merchandise revenue
 * @param top14Players - Top 14 players by OVR (from league_players + player for IR)
 * @param merchPercentage - Team's merch % (30 base + draft bonuses)
 * @returns Revenue in dollars
 */
export function computeTeamMerchRevenue(
  top14Players: MerchPlayer[],
  merchPercentage: number
): number {
  const pct = Math.max(0, Math.min(100, merchPercentage)) / 100;
  const sum = top14Players
    .slice(0, 14)
    .reduce((acc, p) => acc + playerMerchValue(p), 0);
  return Math.round(sum * pct);
}
