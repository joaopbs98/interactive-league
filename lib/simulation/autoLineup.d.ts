export function buildAutomaticSquadSelection(
  roster: Array<Record<string, unknown>>,
  formationSlots: string[],
): { startingLineup: string[]; bench: string[]; reserves: string[] };
