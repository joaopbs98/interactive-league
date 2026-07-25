// Position familiarity helper - FM-style "natural / familiar / unfamiliar" fit

const POSITION_GROUPS: Record<string, string> = {
  GK: "GK",
  CB: "DEF",
  LB: "DEF",
  RB: "DEF",
  LWB: "DEF",
  RWB: "DEF",
  CDM: "MID",
  CM: "MID",
  CAM: "MID",
  LM: "MID",
  RM: "MID",
  LW: "ATT",
  RW: "ATT",
  CF: "ATT",
  ST: "ATT",
};

export type PositionFit = "natural" | "familiar" | "unfamiliar" | "unknown";

export function parsePositions(positions?: string): string[] {
  if (!positions) return [];
  return positions
    .split(/[,/]/)
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
}

export function getPositionFit(playerPositions: string | undefined, slotLabel: string): PositionFit {
  const playerPos = parsePositions(playerPositions);
  if (playerPos.length === 0) return "unknown";

  const slot = slotLabel.trim().toUpperCase();
  if (playerPos.includes(slot)) return "natural";

  const slotGroup = POSITION_GROUPS[slot];
  if (!slotGroup) return "unknown";

  const sameGroup = playerPos.some((p) => POSITION_GROUPS[p] === slotGroup);
  return sameGroup ? "familiar" : "unfamiliar";
}

export const POSITION_FIT_RING: Record<PositionFit, string> = {
  natural: "ring-status-positive/70",
  familiar: "ring-status-warning/70",
  unfamiliar: "ring-status-negative/70",
  unknown: "ring-border-strong",
};

export const POSITION_FIT_LABEL: Record<PositionFit, string> = {
  natural: "Natural position",
  familiar: "Familiar position",
  unfamiliar: "Out of position",
  unknown: "Unknown",
};
