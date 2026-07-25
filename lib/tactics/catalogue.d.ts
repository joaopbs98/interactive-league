import type { RoleDefinition, TeamTactic, TacticValidationResult } from "./types";

export const TACTICS_ENGINE_VERSION: "fc25-il-1";
export const BUILD_UP_STYLES: readonly string[];
export const DEFENSIVE_APPROACHES: Record<string, { min: number; max: number; default: number }>;
export const VALID_FORMATIONS: readonly string[];
export const ROLE_CATALOGUE: RoleDefinition[];
export function allowedRolesForPosition(position: string): RoleDefinition[];
export function defaultAssignmentForPosition(position: string): { role: string; focus: import("./types").RoleFocus };
export function validateTactic(tactic: TeamTactic): TacticValidationResult;
