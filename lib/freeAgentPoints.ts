/**
 * IL25 Free Agents Points Value formula (from IL25_GAME_LOGIC_TRUTH.md)
 * The team with the highest Points Value wins the player.
 * No-trade clause adds +4% to Points Value (moderator rule).
 */
export function freeAgentPointsValue(
  valueOfContract: number,
  guaranteedPct: number,
  lengthYears: number,
  noTradeClause?: boolean
): number {
  const base = valueOfContract / 100000;
  const g = lengthYears === 1 ? 1 : guaranteedPct; // 1-year contracts always 100%
  let guaranteedMod = 1 + 0.2 * Math.sign(g - 0.25) * Math.pow(Math.abs(g - 0.25), 0.5);
  if (g < 0.2) guaranteedMod += -30.7 * Math.pow(0.2 - g, 2);
  const lengthMod = [1, 0.98, 0.94, 0.88, 0.8][Math.min(lengthYears - 1, 4)] ?? 0.8;
  let result = base * guaranteedMod * lengthMod;
  if (noTradeClause) result *= 1.04;
  return result;
}
