/**
 * IL25 Stadium attendance and revenue formulas (from IL25_GAME_LOGIC_TRUTH.md)
 */

export const PERF_SCORE: Record<string, number> = {
  "UCL Winners": 10,
  "UCL Finalist": 9,
  "UCL Semi-Finalist": 8,
  "UCL Group Stage": 5,
  "UEL Winners": 7,
  "UEL Finalist": 6,
  "UEL Semi-Finalist": 5,
  "UEL Group Stage": 2,
  "UECL Winners": 4,
  "UECL Finalist": 3,
  "UECL Semi-Finalist": 2,
  "UECL Group Stage": 1,
};

export const PRICE_BY_FOCUS: Record<string, number> = {
  "Core Fanbase": 66.86,
  "Local Casuals": 97.35,
  "Tourists": 101.35,
  "Hospitality & VIP": 130.02,
};

export const VISITOR_FOCUS_OPTIONS = [
  "Core Fanbase",
  "Local Casuals",
  "Tourists",
  "Hospitality & VIP",
] as const;

export const SEASONAL_PERFORMANCE_OPTIONS = [
  "UCL Winners",
  "UCL Finalist",
  "UCL Semi-Finalist",
  "UCL Group Stage",
  "UEL Winners",
  "UEL Finalist",
  "UEL Semi-Finalist",
  "UEL Group Stage",
  "UECL Winners",
  "UECL Finalist",
  "UECL Semi-Finalist",
  "UECL Group Stage",
] as const;

export function stadiumAttendance(
  capacity: number,
  visitorFocus: string,
  seasonalPerformance: string
): number {
  if (!seasonalPerformance) return 0;
  const p = PERF_SCORE[seasonalPerformance] ?? 0;
  switch (visitorFocus) {
    case "Core Fanbase":
      return Math.max(36000, capacity - (capacity - 36000) * ((10 - p) / 9));
    case "Local Casuals":
      return capacity * (0.4 + 0.05 * p);
    case "Tourists":
      return capacity * (0.2 + 0.08 * p);
    case "Hospitality & VIP":
      return seasonalPerformance === "UCL Winners" ? capacity : capacity * 0.08 * p;
    default:
      return 0;
  }
}

export function stadiumRevenue(
  attendance: number,
  visitorFocus: string,
  totalGamesPlayed: number
): number {
  const price = PRICE_BY_FOCUS[visitorFocus] ?? 0;
  const raw = attendance * price * (totalGamesPlayed / 2);
  return Math.round(raw / 100000) * 100000;
}
