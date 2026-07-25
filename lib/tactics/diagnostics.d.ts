import type { TacticAssignment } from "./types";
export type DiagnosticKey = "attack" | "defence" | "width" | "endurance" | "length" | "buildUp";
export const ROLE_BEHAVIORS: Record<string, Record<DiagnosticKey, number> & { advance: number; widen: number; keyAttributes: string[] }>;
export function deriveTacticDiagnostics(input: { assignments: TacticAssignment[]; buildUpStyle: string; defensiveApproach: string; lineHeight: number }): Record<DiagnosticKey, number>;
export function deriveWithBallPositions(positions: Array<{ x: number; y: number; label: string }>, assignments: TacticAssignment[]): Array<{ x: number; y: number; label: string }>;
export function roleFamiliarity(player: Record<string, unknown>, slotPosition: string, roleName: string): {
  level: "role_plus_plus" | "role_plus" | "base_role" | "out_of_position";
  multiplier: number;
  profile: number;
  positionFit: "natural" | "familiar" | "out_of_position";
  profileSource: "attributes" | "mixed_fallback" | "overall_fallback";
};
