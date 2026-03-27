# Player Architecture (player vs league_players)

## Rule: Never modify the `player` table

The `player` table is the **master/reference** pool (EAFC data). It is **read-only** for game logic.

## league_players = per-league copies

- Each league has its own copy of players in `league_players`
- Same `player_id` (e.g. Ronaldo) can exist in **multiple leagues** (different rows)
- Within a league: `(league_id, player_id)` is unique
- `league_players` stores: league_id, player_id, team_id (null = free agent), rating, etc.

## Import flow (create league, packs, draft, FA, etc.)

1. **Source**: Read from `player` table
2. **Target**: Insert into `league_players` for that league
3. **Never**: Update or delete from `player`

## Examples

- **Create/Join league**: `auto_starter_squad` copies 18 players from `player` → `league_players` (OVR 50–60)
- **Packs**: Generate players from `player` pool, insert into `league_players` for that league
- **Draft**: Free agents in `league_players` (team_id = null) for that league
- **Free agents**: Same
- **Trades**: Move `league_players.team_id` within the league
