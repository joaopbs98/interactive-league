/** Human-readable labels for sponsor bonus_condition_code */
export const BONUS_CONDITION_LABELS: Record<string, string> = {
  sign_japan_china_top14: "Sign player from Japan or China (in top 14)",
  sign_usa_top14: "Sign player from USA (in top 14)",
  sign_75plus_top14: "Sign player rated 75+ (in top 14)",
  ucl_qualify: "Qualify for UCL (top 4)",
  ucl_or_uel_winner: "Reach UCL or Win UEL",
  ucl_semi: "Reach UCL Semi-Finals",
};

export function getBonusConditionLabel(code: string | null | undefined): string {
  if (!code) return "";
  return BONUS_CONDITION_LABELS[code] ?? code;
}

export function getTransferRequestRankLabel(rank: number | null | undefined): string {
  if (rank == null || rank < 1) return "";
  const ordinals: Record<number, string> = {
    1: "1st highest rated",
    2: "2nd highest rated",
    3: "3rd highest rated",
    4: "4th highest rated",
  };
  return ordinals[rank] ?? `#${rank} rated`;
}

export function getCompetitionLabel(comp: string): string {
  const map: Record<string, string> = {
    ucl: "UCL",
    uel: "UEL",
    uecl: "UECL",
  };
  return map[comp?.toLowerCase()] ?? comp;
}

export function getStageLabel(stage: string): string {
  const map: Record<string, string> = {
    group: "Group stage",
    semi: "Semi-finals",
    finalist: "Finalist",
    winner: "Winner",
  };
  return map[stage?.toLowerCase()] ?? stage;
}
