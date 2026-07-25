export interface SimulationPlayer {
  playerId: string;
  name: string;
  position: string;
  rating: number;
  [attribute: string]: string | number;
}

export interface SimulationTeam {
  id: string;
  players: SimulationPlayer[];
  bench: SimulationPlayer[];
  tactic: {
    formation: string;
    buildUpStyle: string;
    defensiveApproach: string;
    lineHeight: number;
    assignments: Array<{ slotIndex: number; slotPosition: string; playerId: string; role: string; focus: string }>;
  };
}

export interface SimulationSettings {
  overallInfluence: number;
  tacticalInfluence: number;
  homeAdvantage: number;
  variance: number;
  fogStrength: number;
  fatigueEffect: number;
  injuryFrequency: number;
  disciplineFrequency: number;
  goalEnvironment: number;
  trackingEnabled?: boolean;
}

export interface SimulationMatchResult {
  matchId: string;
  seed: string;
  engineVersion: string;
  calibrationVersion: string;
  source: "simulated" | "manual_constrained";
  homeScore: number;
  awayScore: number;
  events: Array<Record<string, unknown> & { type: string; minute: number; teamId: string; playerId: string; secondaryPlayerId: string | null; sequence: number }>;
  teamStats: Record<"home" | "away", Record<string, number>>;
  playerStats: Array<Record<string, unknown> & { playerId: string; teamId: string; minutes: number; rating: number }>;
  tracking: {
    resolution: "adaptive-1-5s";
    chunks: Array<{ index: number; frames: Array<Record<string, unknown> & { second: number; deltaSeconds: number }> }>;
  };
}

export function simulateMatch(input: { matchId: string; seed: string; home: SimulationTeam; away: SimulationTeam; settings: SimulationSettings }): SimulationMatchResult;
export function simulateConstrainedMatch(input: { matchId: string; seed: string; home: SimulationTeam; away: SimulationTeam; settings: SimulationSettings; homeScore: number; awayScore: number }): SimulationMatchResult;
