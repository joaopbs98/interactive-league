import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Check if a user has host rights for a league.
 * Host = commissioner OR owner of a team in league_host_teams.
 */
export async function isLeagueHost(
  supabase: SupabaseClient,
  leagueId: string,
  userId: string
): Promise<boolean> {
  const { data: league } = await supabase
    .from('leagues')
    .select('commissioner_user_id')
    .eq('id', leagueId)
    .single();

  if (league?.commissioner_user_id === userId) {
    return true;
  }

  const { data: hostTeams } = await supabase
    .from('league_host_teams')
    .select('team_id')
    .eq('league_id', leagueId);

  const teamIds = hostTeams?.map((t) => t.team_id) ?? [];
  if (teamIds.length === 0) return false;

  const { data: userTeams } = await supabase
    .from('teams')
    .select('id')
    .in('id', teamIds)
    .eq('user_id', userId);

  return (userTeams?.length ?? 0) > 0;
}
