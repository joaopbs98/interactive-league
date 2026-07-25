export type BuildUpStyle = "short_passing" | "balanced" | "counter";
export type DefensiveApproach = "deep" | "balanced" | "high" | "aggressive";
export type RoleFocus = "defend" | "balanced" | "attack" | "build_up" | "roaming" | "support" | "ball_winning" | "aggressive" | "complete" | "wide";

export interface TacticAssignment {
  slotIndex: number;
  slotPosition: string;
  playerId: string;
  role: string;
  focus: RoleFocus;
}

export interface TeamTactic {
  formation: string;
  buildUpStyle: BuildUpStyle;
  defensiveApproach: DefensiveApproach;
  lineHeight: number;
  assignments: TacticAssignment[];
}

export interface TacticValidationError {
  code: string;
  message: string;
  slotIndex?: number;
}

export interface TacticValidationResult {
  valid: boolean;
  errors: TacticValidationError[];
}

export interface RoleDefinition {
  positions: string[];
  role: string;
  focuses: RoleFocus[];
}

