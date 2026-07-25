export type SquadDiagnostic = {
  key: string;
  label: string;
  score: number;
  status: "strength" | "mixed" | "gap";
  weakest: Array<{ playerId: string; name: string; value: number }>;
  fallbackCount: number;
  playerCount: number;
};
export function deriveSquadDiagnostics(players: object[], assignments: object[]): SquadDiagnostic[];
