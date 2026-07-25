export interface TacticsPlayer {
  player_id: string;
  name: string;
  full_name?: string;
  positions: string;
  overall_rating: number;
  image?: string;
  role?: string;
  description?: string;
  isInjured?: boolean;
  injuryType?: string;
  gamesRemaining?: number;
}
