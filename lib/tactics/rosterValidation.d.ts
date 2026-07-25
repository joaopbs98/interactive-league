type OwnedPlayer = { player_id: string; player_name?: string | null; injury_games_remaining?: number | null; suspension_games_remaining?: number | null };
export function validateRosterSelection(input: { starting: string[]; bench: string[]; reserves: string[]; ownedPlayers: OwnedPlayer[] }): string[];
