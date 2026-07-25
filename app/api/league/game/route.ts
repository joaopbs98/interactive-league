import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { isLeagueHost } from '@/lib/hostUtils';
import { simulateConstrainedMatch, simulateMatch } from '@/lib/simulation/engine.mjs';
import { buildSimulationPlayer, mapSimulationSettings, toPlayerIds } from '@/lib/simulation/adapter.mjs';
import { formationPositions } from '@/lib/formationPositions';
import { defaultAssignmentForPosition } from '@/lib/tactics/catalogue.mjs';
import { applySimulationPreset, validateSimulationSettings } from '@/lib/simulation/settings.mjs';
import { buildAutomaticSquadSelection } from '@/lib/simulation/autoLineup.mjs';
import { MOCK_CLUB_CATALOGUE } from '@/lib/mock-clubs/catalogue.mjs';
import { buildAnalyticsPersistence } from '@/lib/simulation/persistence.mjs';
import { aggregateSeasonPlayers } from '@/lib/simulation/seasonAnalytics.mjs';
import { roleFamiliarity } from '@/lib/tactics/diagnostics.mjs';

const mockClubTestingEnabled = () =>
  process.env.NODE_ENV !== 'production' || process.env.ENABLE_MOCK_CLUB_TESTING === 'true';

async function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function refreshPlayerSeasonAnalytics(db: any, leagueId: string, season: number, competitionType: string) {
  let query = db.from('matches').select('id,home_team_id,away_team_id').eq('league_id', leagueId)
    .eq('season', season).eq('match_status', 'simulated');
  query = competitionType === 'domestic' ? query.or('competition_type.eq.domestic,competition_type.is.null') : query.eq('competition_type', competitionType);
  const { data: matches } = await query;
  const matchIds = (matches || []).map((match: any) => match.id);
  if (!matchIds.length) return;
  const { data: rows } = await db.from('player_match_stats').select('*').in('match_id', matchIds).eq('engine_version', 'fc25-il-2');
  const teamMatchesPlayed = new Map<string, number>();
  for (const match of matches || []) {
    teamMatchesPlayed.set(match.home_team_id, (teamMatchesPlayed.get(match.home_team_id) || 0) + 1);
    teamMatchesPlayed.set(match.away_team_id, (teamMatchesPlayed.get(match.away_team_id) || 0) + 1);
  }
  const summaries = aggregateSeasonPlayers(rows || [], { teamMatchesPlayed });
  if (!summaries.length) return;
  await db.from('player_season_analytics').upsert(summaries.map((summary: any) => ({
    league_id: leagueId, season, competition_type: competitionType, team_id: summary.teamId,
    player_id: summary.playerId, engine_version: 'fc25-il-2', appearances: summary.appearances,
    qualifying_appearances: summary.qualifyingAppearances,
    starts: (rows || []).filter((row: any) => row.player_id === summary.playerId && row.starter).length,
    minutes: summary.minutes, rating_minutes: summary.ratingMinutes, average_rating: summary.averageRating,
    goals: summary.goals, assists: summary.assists, xg: summary.xg, xa: summary.xa,
    yellow_cards: summary.yellow_cards, red_cards: summary.red_cards,
    advanced_totals: summary, updated_at: new Date().toISOString(),
  })), { onConflict: 'league_id,season,competition_type,team_id,player_id,engine_version' });
}

async function insertMatchdayNotifications(
  supabase: Awaited<ReturnType<typeof getServiceSupabase>>,
  leagueId: string,
  round: number,
  competitionType: string
) {
  const { data: league } = await supabase.from('leagues').select('season').eq('id', leagueId).single();
  const season = league?.season ?? 1;

  let query = supabase
    .from('matches')
    .select(`
      id,
      home_team_id,
      away_team_id,
      home_score,
      away_score,
      home_team:teams!matches_home_team_id_fkey(id, acronym, user_id),
      away_team:teams!matches_away_team_id_fkey(id, acronym, user_id)
    `)
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('round', round)
    .eq('match_status', 'simulated');

  if (competitionType === 'domestic') {
    query = query.or('competition_type.eq.domestic,competition_type.is.null');
  } else {
    query = query.eq('competition_type', competitionType);
  }

  const { data: matches } = await query;

  if (!matches?.length) return;

  const compLabel = competitionType === 'domestic' ? '' : `${competitionType.toUpperCase()} `;

  for (const m of matches as any[]) {
    const homeScore = m.home_score ?? 0;
    const awayScore = m.away_score ?? 0;
    const homeAcronym = m.home_team?.acronym ?? 'Home';
    const awayAcronym = m.away_team?.acronym ?? 'Away';
    const homeUserId = m.home_team?.user_id;
    const awayUserId = m.away_team?.user_id;

    const homeWdl = homeScore > awayScore ? 'W' : homeScore < awayScore ? 'L' : 'D';
    const awayWdl = awayScore > homeScore ? 'W' : awayScore < homeScore ? 'L' : 'D';

    const homeMsg = `${compLabel}Matchday result: vs ${awayAcronym} ${homeScore}-${awayScore} — ${homeWdl}`;
    const awayMsg = `${compLabel}Matchday result: vs ${homeAcronym} ${homeScore}-${awayScore} — ${awayWdl}`;

    if (homeUserId) {
      await supabase.from('notifications').insert({
        user_id: homeUserId,
        league_id: leagueId,
        team_id: m.home_team_id,
        type: 'matchday_played',
        title: 'Matchday result',
        message: homeMsg,
        read: false,
        link: '/main/dashboard/schedule',
      });
    }
    if (awayUserId) {
      await supabase.from('notifications').insert({
        user_id: awayUserId,
        league_id: leagueId,
        team_id: m.away_team_id,
        type: 'matchday_played',
        title: 'Matchday result',
        message: awayMsg,
        read: false,
        link: '/main/dashboard/schedule',
      });
    }
  }
}

async function loadSimulationTeam(db: any, teamId: string, leagueId: string) {
  const { data: team, error: teamError } = await db.from('teams')
    .select('id, name, formation, starting_lineup, bench').eq('id', teamId).eq('league_id', leagueId).single();
  if (teamError || !team) throw new Error('Simulation team not found');
  const startingIds = toPlayerIds(team.starting_lineup);
  if (startingIds.length !== 11) throw new Error(`${team.name} needs a complete starting XI`);
  const benchIds = toPlayerIds(team.bench).slice(0, 7);
  const { data: playerRows, error: playerError } = await db.from('league_players').select('*')
    .eq('league_id', leagueId).eq('team_id', teamId).in('player_id', [...startingIds, ...benchIds]);
  if (playerError) throw new Error(`Could not load ${team.name} players`);
  const { data: availabilityRows } = await db.from('player_availability_state').select('player_id, fatigue')
    .eq('league_id', leagueId).in('player_id', [...startingIds, ...benchIds]);
  const availabilityMap = new Map<string, any>((availabilityRows || []).map((row: any) => [row.player_id, row]));
  const playerMap = new Map((playerRows || []).map((row: any) => [row.player_id, buildSimulationPlayer({
    ...row, fatigue: availabilityMap.get(row.player_id)?.fatigue ?? 0,
  })]));
  const players = startingIds.map((id) => playerMap.get(id)).filter(Boolean);
  if (players.length !== 11) throw new Error(`${team.name} has invalid players in the starting XI`);
  const unavailableStarters = players.filter((player: any) => player.injuryGamesRemaining > 0 || player.suspensionGamesRemaining > 0);
  if (unavailableStarters.length) {
    const details = unavailableStarters.map((player: any) => `${player.name} (${player.injuryGamesRemaining > 0 ? `injured ${player.injuryGamesRemaining} game${player.injuryGamesRemaining === 1 ? '' : 's'}` : `suspended ${player.suspensionGamesRemaining} game${player.suspensionGamesRemaining === 1 ? '' : 's'}`})`).join(', ');
    throw new Error(`${team.name} has unavailable starters: ${details}`);
  }
  const eligibleBench = benchIds.map((id) => playerMap.get(id)).filter((player: any) => player && player.injuryGamesRemaining === 0 && player.suspensionGamesRemaining === 0);
  const warnings = [];
  if (eligibleBench.length < 3) warnings.push(`${team.name} has only ${eligibleBench.length} available substitute${eligibleBench.length === 1 ? '' : 's'}`);

  const { data: tactic } = await db.from('team_tactics').select('id, formation, build_up_style, defensive_approach, line_height')
    .eq('team_id', teamId).eq('league_id', leagueId).eq('is_active', true).maybeSingle();
  const slots = formationPositions[tactic?.formation || team.formation || '4-3-3'] || formationPositions['4-3-3'];
  let assignments: any[] = [];
  if (tactic) {
    const { data } = await db.from('team_tactic_assignments').select('slot_index, slot_position, player_id, role, focus').eq('tactic_id', tactic.id).order('slot_index');
    assignments = (data || []).map((item: any) => ({ slotIndex: item.slot_index, slotPosition: item.slot_position, playerId: item.player_id, role: item.role, focus: item.focus }));
  }
  if (assignments.length !== 11) {
    assignments = slots.slice(0, 11).map((slot, slotIndex) => ({
      slotIndex, slotPosition: slot.label, playerId: startingIds[slotIndex], ...defaultAssignmentForPosition(slot.label),
    }));
  }
  for (const assignment of assignments) {
    const player: any = playerMap.get(assignment.playerId);
    if (!player) continue;
    const fit = roleFamiliarity(player, assignment.slotPosition, assignment.role);
    if (fit.positionFit === 'out_of_position') {
      warnings.push(`${team.name}: ${player.name} is out of position at ${assignment.slotPosition} (${Math.round(fit.multiplier * 100)}% execution)`);
    }
  }
  return {
    id: team.id,
    name: team.name,
    players,
    bench: eligibleBench,
    warnings,
    tactic: {
      formation: tactic?.formation || team.formation || '4-3-3',
      buildUpStyle: tactic?.build_up_style || 'balanced',
      defensiveApproach: tactic?.defensive_approach || 'balanced',
      lineHeight: tactic?.line_height || 50,
      assignments,
    },
  };
}

async function ensureAutomaticLineup(db: any, team: any, leagueId: string) {
  if (toPlayerIds(team.starting_lineup).length === 11) return { updated: false };
  const { data: roster, error } = await db.from('league_players').select('player_id, positions, rating')
    .eq('league_id', leagueId).eq('team_id', team.id);
  if (error) throw new Error(`Could not load ${team.name || 'team'} roster`);
  const slots = (formationPositions[team.formation || '4-3-3'] || formationPositions['4-3-3']).map((slot) => slot.label);
  const selection = buildAutomaticSquadSelection(roster || [], slots);
  if (selection.startingLineup.length !== 11) throw new Error(`${team.name || 'Team'} does not have enough players for an automatic XI`);
  const { error: updateError } = await db.from('teams').update({
    starting_lineup: selection.startingLineup,
    bench: selection.bench,
    reserves: selection.reserves,
  }).eq('id', team.id).eq('league_id', leagueId);
  if (updateError) throw new Error(`Could not save ${team.name || 'team'} automatic XI`);
  return { updated: true };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, leagueId, ...params } = body;

    if (!leagueId) {
      return NextResponse.json({ success: false, error: 'League ID required' }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();

    switch (action) {
      case 'preview_matchday': {
        const host = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!host) return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        const db: any = serviceSupabase;
        const competitionType = params.competitionType || 'domestic';
        if (!['domestic', 'ucl', 'uel', 'uecl', 'supercup'].includes(competitionType)) {
          return NextResponse.json({ success: false, error: 'Invalid competition type' }, { status: 400 });
        }
        const { data: league } = await db.from('leagues').select('season, status, current_round, current_round_ucl, current_round_uel, current_round_uecl').eq('id', leagueId).single();
        if (!league || league.status !== 'IN_SEASON') return NextResponse.json({ success: false, error: 'League must be IN_SEASON' }, { status: 400 });
        const round = competitionType === 'domestic' ? league.current_round
          : competitionType === 'ucl' ? (league.current_round_ucl || 1)
          : competitionType === 'uel' ? (league.current_round_uel || 1)
          : competitionType === 'uecl' ? (league.current_round_uecl || 1) : 1;
        let matchQuery = db.from('matches').select('id, home_team_id, away_team_id').eq('league_id', leagueId)
          .eq('season', league.season).eq('round', round).eq('match_status', 'scheduled');
        matchQuery = competitionType === 'domestic' ? matchQuery.or('competition_type.eq.domestic,competition_type.is.null') : matchQuery.eq('competition_type', competitionType);
        if (params.matchId) matchQuery = matchQuery.eq('id', params.matchId);
        matchQuery = matchQuery.order('id', { ascending: true }).limit(1);
        const { data: fixtures, error: fixtureError } = await matchQuery;
        if (fixtureError || !fixtures?.length) return NextResponse.json({ success: false, error: 'No scheduled matches for this round' }, { status: 400 });
        const targetMatchId = fixtures[0].id;

        const { data: settingsRow } = await db.from('simulation_settings').select('*').eq('league_id', leagueId).maybeSingle();
        const settings = mapSimulationSettings(settingsRow);
        const { data: priorRows } = await db.from('simulation_previews').select('id, attempt, status, seed, output_snapshot, created_at').eq('league_id', leagueId)
          .eq('season', league.season).eq('competition_type', competitionType).eq('round', round).eq('match_id', targetMatchId)
          .order('attempt', { ascending: false }).limit(1);
        const prior = priorRows?.[0];
        if (prior?.status === 'preview' && !params.reroll) return NextResponse.json({ success: true, data: { ...prior, rerolls_remaining: Math.max(0, (settingsRow?.preview_rerolls ?? 1) - prior.attempt) }, existing: true });
        const attempt = prior ? prior.attempt + 1 : 0;
        const rerollLimit = settingsRow?.preview_rerolls ?? 1;
        if (attempt > rerollLimit) return NextResponse.json({ success: false, error: 'Preview reroll limit reached' }, { status: 400 });
        await db.from('simulation_previews').update({ status: 'discarded' }).eq('league_id', leagueId)
          .eq('season', league.season).eq('competition_type', competitionType).eq('round', round).eq('match_id', targetMatchId).eq('status', 'preview');

        const results = [];
        const inputTeams: Record<string, any> = {};
        for (const fixture of fixtures) {
          inputTeams[fixture.home_team_id] ||= await loadSimulationTeam(db, fixture.home_team_id, leagueId);
          inputTeams[fixture.away_team_id] ||= await loadSimulationTeam(db, fixture.away_team_id, leagueId);
          const seed = `${leagueId}:${league.season}:${competitionType}:${round}:${attempt}:${fixture.id}`;
          const result = simulateMatch({ matchId: fixture.id, seed, home: inputTeams[fixture.home_team_id], away: inputTeams[fixture.away_team_id], settings });
          const matchPlayers = [...inputTeams[fixture.home_team_id].players, ...inputTeams[fixture.home_team_id].bench,
            ...inputTeams[fixture.away_team_id].players, ...inputTeams[fixture.away_team_id].bench];
          const playerNames = new Map(matchPlayers.map((player: any) => [player.playerId, player.name]));
          const playerPositions = new Map(matchPlayers.map((player: any) => [player.playerId, player.position]));
          const events = result.events.map((event: any) => ({
            ...event,
            playerName: event.playerId ? playerNames.get(event.playerId) || 'Unknown player' : null,
            secondaryPlayerName: event.secondaryPlayerId ? playerNames.get(event.secondaryPlayerId) || 'Unknown player' : null,
          }));
          const playerStats = result.playerStats.map((line: any) => ({
            ...line,
            playerName: playerNames.get(line.playerId) || 'Unknown player',
            naturalPosition: playerPositions.get(line.playerId) || '',
            position: line.slotPosition || playerPositions.get(line.playerId) || '',
          }));
          results.push({ ...result, events, playerStats, homeTeamId: fixture.home_team_id, awayTeamId: fixture.away_team_id, homeTeamName: inputTeams[fixture.home_team_id].name, awayTeamName: inputTeams[fixture.away_team_id].name });
        }
        const warnings = [...new Set(Object.values(inputTeams).flatMap((team: any) => team.warnings || []))];
        const seed = `${leagueId}:${league.season}:${competitionType}:${round}:${targetMatchId}:${attempt}`;
        const { data: preview, error: previewError } = await db.from('simulation_previews').insert({
          league_id: leagueId, season: league.season, round, competition_type: competitionType, match_id: targetMatchId, attempt, seed,
          engine_version: 'fc25-il-2', settings_snapshot: settings, input_snapshot: { teams: inputTeams },
          output_snapshot: { matches: results, warnings }, status: 'preview', created_by: user.id,
        }).select('id, attempt, seed, output_snapshot, created_at').single();
        if (previewError) return NextResponse.json({ success: false, error: previewError.message }, { status: 500 });
        return NextResponse.json({ success: true, data: { ...preview, rerolls_remaining: Math.max(0, rerollLimit - attempt) } });
      }

      case 'commit_matchday_preview': {
        const host = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!host) return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        if (!params.previewId) return NextResponse.json({ success: false, error: 'previewId required' }, { status: 400 });

        const { data, error } = await serviceSupabase.rpc('commit_simulation_preview' as any, {
          p_preview_id: params.previewId,
          p_actor_user_id: user.id,
        } as any);
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        if (!(data as any)?.success) return NextResponse.json({ success: false, error: (data as any)?.error || 'Could not commit preview' }, { status: 400 });

        const db: any = serviceSupabase;
        const { data: preview } = await db.from('simulation_previews')
          .select('round, season, competition_type, output_snapshot').eq('id', params.previewId).single();
        if (preview) {
          for (const matchResult of preview.output_snapshot?.matches || []) {
            if (matchResult.engineVersion !== 'fc25-il-2') continue;
            const analytics = buildAnalyticsPersistence(matchResult, {
              leagueId,
              season: preview.season,
              competitionType: preview.competition_type,
            });
            await db.from('matches').update(analytics.match).eq('id', matchResult.matchId).eq('league_id', leagueId);
            for (const row of analytics.teamStats) {
              const { match_id, team_id, ...advanced } = row;
              await db.from('team_match_stats').update(advanced).eq('match_id', match_id).eq('team_id', team_id);
            }
            for (const row of analytics.playerStats) {
              const { match_id, player_id, ...advanced } = row;
              await db.from('player_match_stats').update(advanced).eq('match_id', match_id).eq('player_id', player_id);
            }
            if (analytics.trackingChunks.length) {
              await db.from('match_tracking_chunks').upsert(analytics.trackingChunks, {
                onConflict: 'match_id,engine_version,chunk_index',
              });
            }
          }
          await insertMatchdayNotifications(serviceSupabase, leagueId, preview.round, preview.competition_type);
          await refreshPlayerSeasonAnalytics(db, leagueId, preview.season, preview.competition_type);
        }
        return NextResponse.json({ success: true, data });
      }

      case 'update_simulation_settings': {
        const host = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!host) return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        const preset = ['balanced', 'rating_heavy', 'tactical', 'custom'].includes(params.preset) ? params.preset : 'balanced';
        const settings = preset === 'custom' ? params.settings : applySimulationPreset(preset);
        const errors = validateSimulationSettings(settings);
        if (errors.length) return NextResponse.json({ success: false, error: errors.join('. ') }, { status: 400 });
        const { data, error } = await (serviceSupabase as any).from('simulation_settings').upsert({
          league_id: leagueId, preset,
          overall_influence: settings.overallInfluence, tactical_influence: settings.tacticalInfluence,
          home_advantage: settings.homeAdvantage, variance: settings.variance, fog_strength: settings.fogStrength,
          fatigue_effect: settings.fatigueEffect, injury_frequency: settings.injuryFrequency,
          discipline_frequency: settings.disciplineFrequency, goal_environment: settings.goalEnvironment,
          preview_rerolls: settings.previewRerolls, engine_version: 'fc25-il-2', updated_at: new Date().toISOString(),
        }).select('*').single();
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        await (serviceSupabase as any).from('simulation_previews').update({ status: 'expired' }).eq('league_id', leagueId).eq('status', 'preview');
        return NextResponse.json({ success: true, data });
      }

      case 'generate_schedule': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { data: league } = await serviceSupabase
          .from('leagues')
          .select('season')
          .eq('id', leagueId)
          .single();

        const { data: validation } = await serviceSupabase.rpc('validate_league_registration', {
          p_league_id: leagueId
        });
        if (validation && !validation.valid && validation.invalid_teams?.length > 0) {
          const msg = validation.invalid_teams
            .map((t: { team_name: string; errors: string[] }) => `${t.team_name}: ${(t.errors || []).join('; ')}`)
            .join('. ');
          return NextResponse.json({ success: false, error: `Registration invalid: ${msg}` }, { status: 400 });
        }

        // Teams with >23 players don't block the season, but get fined per excess player
        if (validation?.fine_teams?.length > 0) {
          for (const t of validation.fine_teams as { team_id: string; team_name: string; excess_players: number; fine_amount: number }[]) {
            await serviceSupabase.rpc('apply_fine', {
              p_league_id: leagueId,
              p_team_id: t.team_id,
              p_amount: t.fine_amount,
              p_reason: `Oversized squad at season start (${t.excess_players} player${t.excess_players === 1 ? '' : 's'} over the 23-player limit)`,
              p_actor_id: user.id
            });
          }
        }

        const { data, error } = await serviceSupabase.rpc('generate_schedule', {
          p_league_id: leagueId,
          p_season: league?.season || 1
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        await serviceSupabase
          .from('leagues')
          .update({ status: 'IN_SEASON' })
          .eq('id', leagueId);

        return NextResponse.json({ success: true, data });
      }

      case 'simulate_matchday': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { data: league } = await serviceSupabase
          .from('leagues')
          .select('status')
          .eq('id', leagueId)
          .single();

        if (league?.status !== 'IN_SEASON') {
          return NextResponse.json({ success: false, error: 'League must be IN_SEASON' }, { status: 400 });
        }

        const { data, error } = await serviceSupabase.rpc('simulate_matchday', {
          p_league_id: leagueId
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        if (data?.success && data?.round) {
          await insertMatchdayNotifications(serviceSupabase, leagueId, data.round, 'domestic');
        }

        return NextResponse.json({ success: true, data });
      }

      case 'simulate_matchday_competition': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const competitionType = body.competitionType as string;
        if (!['ucl', 'uel', 'uecl', 'supercup'].includes(competitionType)) {
          return NextResponse.json({ success: false, error: 'competitionType must be ucl, uel, uecl, or supercup' }, { status: 400 });
        }

        const { data: league } = await serviceSupabase
          .from('leagues')
          .select('status')
          .eq('id', leagueId)
          .single();

        if (league?.status !== 'IN_SEASON') {
          return NextResponse.json({ success: false, error: 'League must be IN_SEASON' }, { status: 400 });
        }

        const { data, error } = await serviceSupabase.rpc('simulate_matchday_competition', {
          p_league_id: leagueId,
          p_competition_type: competitionType,
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        if (data?.success && data?.round) {
          await insertMatchdayNotifications(serviceSupabase, leagueId, data.round, competitionType);
        }

        return NextResponse.json({ success: true, data });
      }

      case 'end_season': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { data, error } = await serviceSupabase.rpc('end_season', {
          p_league_id: leagueId
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        if (data?.success) {
          await serviceSupabase.rpc('update_league_stock_prices', { p_league_id: leagueId });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'recalculate_compindex': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { error } = await serviceSupabase.rpc('update_league_compindex', {
          p_league_id: leagueId
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: { message: 'CompIndex recalculated' } });
      }

      case 'validate_registration': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { data, error } = await serviceSupabase.rpc('validate_league_registration', {
          p_league_id: leagueId
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'apply_fine': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { teamId, amount, reason } = params;
        if (!teamId || !amount || !reason) {
          return NextResponse.json({ success: false, error: 'teamId, amount, and reason required' }, { status: 400 });
        }

        const { data, error } = await serviceSupabase.rpc('apply_fine', {
          p_league_id: leagueId,
          p_team_id: teamId,
          p_amount: amount,
          p_reason: reason,
          p_actor_id: user.id
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'generate_injuries': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { data, error } = await serviceSupabase.rpc('generate_random_injuries', {
          p_league_id: leagueId,
          p_actor_id: user.id,
          p_count: params.count || 3
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'auto_starter_squad': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { teamId } = params;
        if (!teamId) {
          return NextResponse.json({ success: false, error: 'teamId required' }, { status: 400 });
        }

        const { data: league } = await serviceSupabase
          .from('leagues')
          .select('season')
          .eq('id', leagueId)
          .single();

        const { data, error } = await serviceSupabase.rpc('auto_starter_squad', {
          p_team_id: teamId,
          p_league_id: leagueId,
          p_season: league?.season || 1
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'generate_all_starter_squads': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { data: league } = await serviceSupabase
          .from('leagues')
          .select('season')
          .eq('id', leagueId)
          .single();

        const { data: leagueTeams } = await serviceSupabase
          .from('teams')
          .select('id, name, user_id, formation, starting_lineup')
          .eq('league_id', leagueId);

        const results: { teamId: string; success: boolean; error?: string; action?: string }[] = [];
        for (const team of leagueTeams || []) {
          const { count } = await serviceSupabase
            .from('league_players')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', team.id);

          const playerCount = count || 0;

          if (playerCount === 0) {
            const { error } = await serviceSupabase.rpc('auto_starter_squad', {
              p_team_id: team.id,
              p_league_id: leagueId,
              p_season: league?.season || 1
            });
            results.push({ teamId: team.id, success: !error, error: error?.message, action: 'generated' });
          } else if (playerCount < 21) {
            const { data, error } = await serviceSupabase.rpc('top_up_squad_to_21', {
              p_team_id: team.id,
              p_league_id: leagueId
            });
            const r = data as { success?: boolean; added?: number };
            results.push({
              teamId: team.id,
              success: !error && (r?.success ?? true),
              error: error?.message,
              action: 'topped_up'
            });
          }

          if (team.user_id === null && toPlayerIds(team.starting_lineup).length !== 11) {
            try {
              const lineup = await ensureAutomaticLineup(serviceSupabase, team, leagueId);
              if (lineup.updated) results.push({ teamId: team.id, success: true, action: 'auto_lineup' });
            } catch (error: any) {
              results.push({ teamId: team.id, success: false, error: error.message, action: 'auto_lineup' });
            }
          }
        }

        return NextResponse.json({
          success: true,
          data: { generated: results.filter(r => r.success).length, total: results.length, results }
        });
      }

      case 'start_draft': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { data, error } = await serviceSupabase.rpc('start_draft', {
          p_league_id: leagueId
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'insert_result': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { matchId, homeScore, awayScore } = params;
        if (!matchId || homeScore == null || awayScore == null) {
          return NextResponse.json({ success: false, error: 'matchId, homeScore, awayScore required' }, { status: 400 });
        }

        const { data, error } = await serviceSupabase.rpc('insert_match_result', {
          p_match_id: matchId,
          p_home_score: parseInt(String(homeScore), 10),
          p_away_score: parseInt(String(awayScore), 10),
          p_actor_user_id: user.id,
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }

        const db: any = serviceSupabase;
        const { data: match } = await db.from('matches')
          .select('id,season,competition_type,home_team_id,away_team_id').eq('id', matchId).eq('league_id', leagueId).single();
        if (match) {
          const [{ data: settingsRow }, homeTeam, awayTeam] = await Promise.all([
            db.from('simulation_settings').select('*').eq('league_id', leagueId).maybeSingle(),
            loadSimulationTeam(db, match.home_team_id, leagueId),
            loadSimulationTeam(db, match.away_team_id, leagueId),
          ]);
          const constrained = simulateConstrainedMatch({
            matchId,
            seed: `${leagueId}:${match.season}:${match.competition_type || 'domestic'}:${matchId}:manual`,
            home: homeTeam,
            away: awayTeam,
            settings: mapSimulationSettings(settingsRow),
            homeScore: parseInt(String(homeScore), 10),
            awayScore: parseInt(String(awayScore), 10),
          });
          (constrained as any).homeTeamId = match.home_team_id;
          (constrained as any).awayTeamId = match.away_team_id;
          const competitionType = match.competition_type || 'domestic';
          await db.from('match_events').delete().eq('match_id', matchId);
          await db.from('team_match_stats').delete().eq('match_id', matchId);
          await db.from('player_match_stats').delete().eq('match_id', matchId);
          await db.from('match_events').insert(constrained.events.map((event: any) => ({
            match_id: matchId, league_id: leagueId, season: match.season, sequence: event.sequence,
            minute: event.minute, team_id: event.teamId, player_id: event.playerId,
            secondary_player_id: event.secondaryPlayerId, event_type: event.type, metadata: event.metadata || {},
          })));
          await db.from('team_match_stats').insert((['home', 'away'] as const).map((side) => {
            const line: any = constrained.teamStats[side];
            return {
              match_id: matchId, league_id: leagueId, team_id: side === 'home' ? match.home_team_id : match.away_team_id,
              possession: line.possession, shots: line.shots, shots_on_target: line.shotsOnTarget, xg: line.xg,
              passes: line.passes, completed_passes: line.completedPasses, corners: line.corners,
              fouls: line.fouls, offsides: line.offsides, saves: line.saves, tactic_snapshot: side === 'home' ? homeTeam.tactic : awayTeam.tactic,
            };
          }));
          await db.from('player_match_stats').insert(constrained.playerStats.map((line: any) => ({
            match_id: matchId, league_id: leagueId, team_id: line.teamId, player_id: line.playerId,
            starter: line.starter, role: line.role, focus: line.focus, minutes: line.minutes, rating: line.rating,
            goals: line.goals, assists: line.assists, shots: line.shots, shots_on_target: line.shotsOnTarget,
            key_passes: line.keyPasses, passes: line.passes, completed_passes: line.completedPasses,
            tackles: line.tackles, interceptions: line.interceptions, saves: line.saves, fouls: line.fouls,
            yellow_cards: line.yellowCards, red_cards: line.redCards, fatigue_delta: line.fatigueDelta,
          })));
          const analytics = buildAnalyticsPersistence(constrained, { leagueId, season: match.season, competitionType });
          await db.from('matches').update(analytics.match).eq('id', matchId);
          for (const row of analytics.teamStats) {
            const { match_id, team_id, ...advanced } = row;
            await db.from('team_match_stats').update(advanced).eq('match_id', match_id).eq('team_id', team_id);
          }
          for (const row of analytics.playerStats) {
            const { match_id, player_id, ...advanced } = row;
            await db.from('player_match_stats').update(advanced).eq('match_id', match_id).eq('player_id', player_id);
          }
          await db.from('match_tracking_chunks').upsert(analytics.trackingChunks, { onConflict: 'match_id,engine_version,chunk_index' });
          await refreshPlayerSeasonAnalytics(db, leagueId, match.season, competitionType);
        }

        return NextResponse.json({ success: true, data });
      }

      case 'set_competition_result': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { teamId, season, stage } = params;
        if (!teamId || !stage) {
          return NextResponse.json({ success: false, error: 'teamId and stage required' }, { status: 400 });
        }

        const { data: league } = await serviceSupabase
          .from('leagues')
          .select('season')
          .eq('id', leagueId)
          .single();

        const targetSeason = season ?? league?.season ?? 1;

        const { data, error } = await serviceSupabase.rpc('set_team_competition_result', {
          p_team_id: teamId,
          p_league_id: leagueId,
          p_season: targetSeason,
          p_stage: stage,
          p_actor_user_id: user.id,
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'update_draft_pick_bonus': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { draftPickId, bonus } = params;
        if (!draftPickId || !bonus) {
          return NextResponse.json({ success: false, error: 'draftPickId and bonus required' }, { status: 400 });
        }

        const { data, error } = await serviceSupabase.rpc('update_draft_pick_bonus', {
          p_draft_pick_id: draftPickId,
          p_bonus: bonus,
          p_actor_user_id: user.id,
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'resolve_free_agency': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { data, error } = await serviceSupabase.rpc('resolve_free_agency', {
          p_league_id: leagueId,
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          data: { assigned: data?.assigned ?? 0, skipped: data?.skipped ?? 0 },
        });
      }

      case 'add_mock_teams': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { data: league } = await serviceSupabase
          .from('leagues')
          .select('season, max_teams')
          .eq('id', leagueId)
          .single();

        const maxTeams = league?.max_teams ?? 20;
        const { count } = await serviceSupabase
          .from('teams')
          .select('*', { count: 'exact', head: true })
          .eq('league_id', leagueId);

        const slots = maxTeams - (count || 0);
        if (slots <= 0) {
          return NextResponse.json(
            { success: false, error: `League already has ${count} teams (max ${maxTeams})` },
            { status: 400 }
          );
        }

        const season = league?.season || 1;
        const created: string[] = [];

        for (let n = 1; n <= slots; n++) {
          const { data: team, error: teamErr } = await serviceSupabase
            .from('teams')
            .insert({
              league_id: leagueId,
              user_id: null,
              name: `Mock Team ${n}`,
              acronym: `MT${n}`,
              budget: 0,
            })
            .select('id')
            .single();

          if (teamErr || !team) {
            console.error('add_mock_teams: failed to create team', teamErr);
            continue;
          }

          const { error: squadErr } = await serviceSupabase.rpc('auto_starter_squad', {
            p_team_id: team.id,
            p_league_id: leagueId,
            p_season: season,
          });

          if (squadErr) {
            console.error('add_mock_teams: auto_starter_squad failed for', team.id, squadErr);
          } else {
            await ensureAutomaticLineup(serviceSupabase, { ...team, name: `Mock Team ${n}`, formation: '4-3-3', starting_lineup: [] }, leagueId);
          }
          created.push(team.id);
        }

        return NextResponse.json({
          success: true,
          data: { added: created.length, message: `Added ${created.length} mock team(s)` },
        });
      }

      case 'upgrade_mock_teams': {
        if (!mockClubTestingEnabled()) {
          return NextResponse.json({ success: false, error: 'Mock club testing is disabled' }, { status: 404 });
        }
        const host = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!host) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { data: mockTeams, error: teamsError } = await serviceSupabase
          .from('teams')
          .select('id, name, mock_identity_key, created_at')
          .eq('league_id', leagueId)
          .is('user_id', null)
          .order('created_at', { ascending: true });
        if (teamsError) {
          return NextResponse.json({ success: false, error: teamsError.message }, { status: 500 });
        }

        const usedKeys = new Set(
          (mockTeams || []).map((team: any) => team.mock_identity_key).filter(Boolean),
        );
        const available = MOCK_CLUB_CATALOGUE.filter((club) => !usedKeys.has(club.key));
        const targets = (mockTeams || []).filter((team: any) => !team.mock_identity_key);
        const upgraded: Array<{ id: string; previousName: string; name: string; identityKey: string }> = [];

        for (const [index, team] of targets.entries()) {
          const club = available[index];
          if (!club) break;
          const { error: updateError } = await serviceSupabase
            .from('teams')
            .update({
              name: club.name,
              acronym: club.acronym,
              logo_url: `/api/mock-club-badge/${club.key}`,
              mock_identity_key: club.key,
              mock_personality: club.personality,
              mock_primary_color: club.primaryColor,
              mock_secondary_color: club.secondaryColor,
              mock_badge_key: club.badge,
            })
            .eq('id', team.id)
            .eq('league_id', leagueId)
            .is('user_id', null);
          if (updateError) {
            return NextResponse.json({
              success: false,
              error: `Upgraded ${upgraded.length}/${targets.length} clubs before ${team.name} failed: ${updateError.message}`,
              data: { upgraded },
            }, { status: 500 });
          }
          upgraded.push({
            id: team.id,
            previousName: team.name,
            name: club.name,
            identityKey: club.key,
          });
        }

        await serviceSupabase.rpc('write_audit_log', {
          p_league_id: leagueId,
          p_action: 'upgrade_mock_teams',
          p_actor_id: user.id,
          p_payload: { upgraded },
        });

        return NextResponse.json({
          success: true,
          data: {
            upgraded: upgraded.length,
            remaining: Math.max(0, targets.length - upgraded.length),
            clubs: upgraded,
          },
        });
      }

      case 'diversify_mock_tactics': {
        if (!mockClubTestingEnabled()) {
          return NextResponse.json({ success: false, error: 'Mock club testing is disabled' }, { status: 404 });
        }
        const host = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!host) return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        const db: any = serviceSupabase;
        const { data: mockTeams, error: teamsError } = await db.from('teams')
          .select('id, name').eq('league_id', leagueId).is('user_id', null).order('created_at');
        if (teamsError) return NextResponse.json({ success: false, error: teamsError.message }, { status: 500 });
        const formations = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2'];
        const buildUps = ['short_passing', 'balanced', 'counter'];
        const defensiveSetups = [
          { approach: 'deep', lineHeight: 25 },
          { approach: 'balanced', lineHeight: 50 },
          { approach: 'high', lineHeight: 75 },
          { approach: 'aggressive', lineHeight: 95 },
        ];
        const offset = Math.floor(Date.now() / 1000) % formations.length;
        const changed: Array<{ teamId: string; name: string; formation: string }> = [];
        for (const [index, team] of (mockTeams || []).entries()) {
          const formation = formations[(index + offset) % formations.length];
          const slots = (formationPositions[formation] || formationPositions['4-3-3']).slice(0, 11);
          const { data: roster, error: rosterError } = await db.from('league_players')
            .select('player_id, positions, rating').eq('league_id', leagueId).eq('team_id', team.id);
          if (rosterError) return NextResponse.json({ success: false, error: rosterError.message }, { status: 500 });
          const selection = buildAutomaticSquadSelection(roster || [], slots.map((slot) => slot.label));
          if (selection.startingLineup.length !== 11) continue;
          const defensive = defensiveSetups[(index + offset) % defensiveSetups.length];
          const { error: teamUpdateError } = await db.from('teams').update({
            formation,
            starting_lineup: selection.startingLineup,
            bench: selection.bench,
            reserves: selection.reserves,
          }).eq('id', team.id).eq('league_id', leagueId).is('user_id', null);
          if (teamUpdateError) return NextResponse.json({ success: false, error: teamUpdateError.message }, { status: 500 });
          let { data: tactic } = await db.from('team_tactics').select('id').eq('league_id', leagueId)
            .eq('team_id', team.id).eq('is_active', true).maybeSingle();
          if (!tactic) {
            const inserted = await db.from('team_tactics').insert({
              league_id: leagueId, team_id: team.id, name: 'Default', is_active: true, formation,
              build_up_style: buildUps[(index + offset) % buildUps.length],
              defensive_approach: defensive.approach, line_height: defensive.lineHeight,
            }).select('id').single();
            tactic = inserted.data;
          } else {
            await db.from('team_tactics').update({
              formation,
              build_up_style: buildUps[(index + offset) % buildUps.length],
              defensive_approach: defensive.approach,
              line_height: defensive.lineHeight,
              updated_at: new Date().toISOString(),
            }).eq('id', tactic.id);
          }
          if (!tactic?.id) continue;
          await db.from('team_tactic_assignments').delete().eq('tactic_id', tactic.id);
          const assignments = slots.map((slot, slotIndex) => ({
            tactic_id: tactic.id,
            league_id: leagueId,
            player_id: selection.startingLineup[slotIndex],
            slot_index: slotIndex,
            slot_position: slot.label,
            ...defaultAssignmentForPosition(slot.label),
          }));
          const { error: assignmentError } = await db.from('team_tactic_assignments').insert(assignments);
          if (assignmentError) return NextResponse.json({ success: false, error: assignmentError.message }, { status: 500 });
          changed.push({ teamId: team.id, name: team.name, formation });
        }
        await db.from('simulation_previews').update({ status: 'expired' }).eq('league_id', leagueId).eq('status', 'preview');
        return NextResponse.json({ success: true, data: { changed: changed.length, teams: changed } });
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Game API error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId');
    const type = searchParams.get('type');

    if (!leagueId) {
      return NextResponse.json({ success: false, error: 'leagueId required' }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();

    switch (type) {
      case 'match_detail': {
        const matchId = searchParams.get('matchId');
        if (!matchId) return NextResponse.json({ success: false, error: 'matchId required' }, { status: 400 });
        const db: any = serviceSupabase;
        const [{ data: match, error: matchError }, { data: ownedTeam }] = await Promise.all([
          db.from('matches').select(`*, home_team:teams!matches_home_team_id_fkey(id,name,acronym,logo_url), away_team:teams!matches_away_team_id_fkey(id,name,acronym,logo_url)`).eq('id', matchId).eq('league_id', leagueId).single(),
          db.from('teams').select('id').eq('league_id', leagueId).eq('user_id', user.id).limit(1).maybeSingle(),
        ]);
        const host = await isLeagueHost(serviceSupabase, leagueId, user.id);
        if (!host && !ownedTeam) return NextResponse.json({ success: false, error: 'League member only' }, { status: 403 });
        if (matchError || !match) return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404 });

        const [{ data: events }, { data: teamStats }, { data: playerStats }, { data: committedPreview }] = await Promise.all([
          db.from('match_events').select('*').eq('match_id', matchId).order('sequence'),
          db.from('team_match_stats').select('*').eq('match_id', matchId),
          db.from('player_match_stats').select('*').eq('match_id', matchId).order('rating', { ascending: false }),
          db.from('simulation_previews').select('input_snapshot').eq('match_id', matchId).eq('status', 'committed')
            .order('committed_at', { ascending: false }).limit(1).maybeSingle(),
        ]);
        const playerIds = [...new Set([...(events || []).flatMap((event: any) => [event.player_id, event.secondary_player_id]), ...(playerStats || []).map((line: any) => line.player_id)].filter(Boolean))];
        const { data: players } = playerIds.length
          ? await db.from('league_players').select('player_id, player_name, positions').eq('league_id', leagueId).in('player_id', playerIds)
          : { data: [] };
        const playerMap = new Map((players || []).map((player: any) => [player.player_id, player]));
        return NextResponse.json({ success: true, data: {
          match,
          provenance: match.analytics_source || (events?.length || teamStats?.length || playerStats?.length ? 'simulated' : 'manual'),
          engineVersion: match.simulation_engine_version || 'legacy',
          calibrationVersion: match.simulation_calibration_version || null,
          events: (events || []).map((event: any) => ({ ...event, player: playerMap.get(event.player_id) || null, secondary_player: playerMap.get(event.secondary_player_id) || null })),
          teamStats: teamStats || [],
          playerStats: (playerStats || []).map((line: any) => {
            const player = playerMap.get(line.player_id) || null;
            const isGoalkeeper = line.slot_position === 'GK' || String((player as any)?.positions || '').split(',')[0] === 'GK';
            if (!isGoalkeeper) return { ...line, player };
            const opponentStats = (teamStats || []).find((row: any) => row.team_id !== line.team_id);
            const goalsConceded = line.team_id === match.home_team.id ? Number(match.away_score || 0) : Number(match.home_score || 0);
            return {
              ...line,
              player,
              shots_faced: Number(line.shots_faced || opponentStats?.shots_on_target || 0),
              goals_conceded: Number(line.goals_conceded || goalsConceded),
              goals_prevented: Number(line.goals_prevented || (Number(opponentStats?.xgot || 0) - goalsConceded).toFixed(2)),
            };
          }),
          formations: committedPreview?.input_snapshot?.teams || {},
        }});
      }

      case 'player_leaders': {
        const db: any = serviceSupabase;
        const [{ data: league }, { data: ownedTeam }] = await Promise.all([
          db.from('leagues').select('season').eq('id', leagueId).single(),
          db.from('teams').select('id').eq('league_id', leagueId).eq('user_id', user.id).limit(1).maybeSingle(),
        ]);
        const host = await isLeagueHost(serviceSupabase, leagueId, user.id);
        if (!host && !ownedTeam) return NextResponse.json({ success: false, error: 'League member only' }, { status: 403 });
        const targetSeason = Number(searchParams.get('season') || league?.season || 1);
        const { data: seasonMatches, error: matchError } = await db.from('matches').select('id, home_team_id, away_team_id, home_score, away_score')
          .eq('league_id', leagueId).eq('season', targetSeason).or('competition_type.eq.domestic,competition_type.is.null').eq('match_status', 'simulated');
        if (matchError) return NextResponse.json({ success: false, error: matchError.message }, { status: 500 });
        const matchIds = (seasonMatches || []).map((match: any) => match.id);
        if (!matchIds.length) return NextResponse.json({ success: true, data: { season: targetSeason, minimumMinutes: 90, players: [], topScorers: [], topAssists: [], topRated: [], topSaves: [], discipline: [] } });
        const statRows: any[] = [];
        for (let from = 0; ; from += 1000) {
          const { data, error } = await db.from('player_match_stats').select('match_id, team_id, player_id, minutes, rating, goals, assists, shots, shots_on_target, key_passes, passes, completed_passes, tackles, interceptions, saves, fouls, yellow_cards, red_cards, xg, xgot, xa, progressive_passes, touches, carries, progressive_carries, dribbles, successful_dribbles, pressures, recoveries, duels, duels_won, engine_version')
            .eq('league_id', leagueId).in('match_id', matchIds).range(from, from + 999);
          if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
          statRows.push(...(data || []));
          if ((data || []).length < 1000) break;
        }
        const playerIds = [...new Set(statRows.map((row) => row.player_id))];
        const [{ data: players }, { data: teams }] = await Promise.all([
          db.from('league_players').select('player_id, player_name, positions').eq('league_id', leagueId).in('player_id', playerIds),
          db.from('teams').select('id, name, acronym').eq('league_id', leagueId),
        ]);
        const playerMap = new Map<string, { player_id: string; player_name: string; positions: string }>((players || []).map((player: any) => [player.player_id, player]));
        const teamMap = new Map<string, { id: string; name: string; acronym?: string }>((teams || []).map((team: any) => [team.id, team]));
        const totals = new Map<string, any>();
        for (const row of statRows) {
          const total = totals.get(row.player_id) || { playerId: row.player_id, teamId: row.team_id, appearances: 0, qualifyingAppearances: 0, minutes: 0, qualifyingMinutes: 0, ratingMinutes: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, keyPasses: 0, passes: 0, completedPasses: 0, tackles: 0, interceptions: 0, saves: 0, fouls: 0, yellowCards: 0, redCards: 0, xg: 0, xgot: 0, xa: 0, progressivePasses: 0, touches: 0, carries: 0, progressiveCarries: 0, dribbles: 0, successfulDribbles: 0, pressures: 0, recoveries: 0, duels: 0, duelsWon: 0, cleanSheets: 0 };
          total.appearances += 1; total.minutes += Number(row.minutes || 0);
          if (Number(row.minutes || 0) >= 15) {
            total.qualifyingAppearances += 1;
            total.qualifyingMinutes += Number(row.minutes || 0);
            total.ratingMinutes += Number(row.rating || 0) * Number(row.minutes || 0);
          }
          for (const [source, target] of [['goals', 'goals'], ['assists', 'assists'], ['shots', 'shots'], ['shots_on_target', 'shotsOnTarget'], ['key_passes', 'keyPasses'], ['passes', 'passes'], ['completed_passes', 'completedPasses'], ['tackles', 'tackles'], ['interceptions', 'interceptions'], ['saves', 'saves'], ['fouls', 'fouls'], ['yellow_cards', 'yellowCards'], ['red_cards', 'redCards']] as const) total[target] += Number(row[source] || 0);
          for (const [source, target] of [['xg', 'xg'], ['xgot', 'xgot'], ['xa', 'xa'], ['progressive_passes', 'progressivePasses'], ['touches', 'touches'], ['carries', 'carries'], ['progressive_carries', 'progressiveCarries'], ['dribbles', 'dribbles'], ['successful_dribbles', 'successfulDribbles'], ['pressures', 'pressures'], ['recoveries', 'recoveries'], ['duels', 'duels'], ['duels_won', 'duelsWon']] as const) total[target] += Number(row[source] || 0);
          const player = playerMap.get(row.player_id);
          const match = (seasonMatches || []).find((candidate: any) => candidate.id === row.match_id);
          if (String(player?.positions || '').split(',')[0] === 'GK' && match) {
            const conceded = row.team_id === match.home_team_id ? match.away_score : match.home_score;
            if (Number(conceded) === 0 && Number(row.minutes) >= 60) total.cleanSheets += 1;
          }
          totals.set(row.player_id, total);
        }
        const teamMatchesPlayed = new Map<string, number>();
        for (const match of seasonMatches || []) {
          teamMatchesPlayed.set(match.home_team_id, (teamMatchesPlayed.get(match.home_team_id) || 0) + 1);
          teamMatchesPlayed.set(match.away_team_id, (teamMatchesPlayed.get(match.away_team_id) || 0) + 1);
        }
        const rows = [...totals.values()].map((total) => ({ ...total, playerName: playerMap.get(total.playerId)?.player_name || total.playerId, positions: playerMap.get(total.playerId)?.positions || '', team: teamMap.get(total.teamId) || null, averageRating: total.qualifyingMinutes ? Number((total.ratingMinutes / total.qualifyingMinutes).toFixed(2)) : 0, leaderboardEligible: total.qualifyingAppearances >= 3 && total.qualifyingMinutes >= (teamMatchesPlayed.get(total.teamId) || 0) * 90 * 0.3, passCompletion: total.passes ? Number((total.completedPasses / total.passes * 100).toFixed(1)) : 0, shotAccuracy: total.shots ? Number((total.shotsOnTarget / total.shots * 100).toFixed(1)) : 0 }));
        const top = (key: string, minimumMinutes = 0) => [...rows].filter((row) => row.minutes >= minimumMinutes).sort((a, b) => Number(b[key]) - Number(a[key]) || b.minutes - a.minutes).slice(0, 10);
        return NextResponse.json({ success: true, data: { season: targetSeason, minimumAppearanceMinutes: 15, ratingEligibility: '30% team minutes and 3 qualifying appearances', players: rows, topScorers: top('goals'), topAssists: top('assists'), topRated: [...rows].filter((row) => row.leaderboardEligible).sort((a, b) => b.averageRating - a.averageRating || b.qualifyingMinutes - a.qualifyingMinutes).slice(0, 10), topSaves: top('saves'), discipline: [...rows].sort((a, b) => (b.redCards * 3 + b.yellowCards) - (a.redCards * 3 + a.yellowCards)).slice(0, 10) } });
      }

      case 'player_history': {
        const playerId = searchParams.get('playerId');
        if (!playerId) return NextResponse.json({ success: false, error: 'playerId required' }, { status: 400 });
        const db: any = serviceSupabase;
        const [{ data: ownedTeam }, { data: player }] = await Promise.all([
          db.from('teams').select('id').eq('league_id', leagueId).eq('user_id', user.id).limit(1).maybeSingle(),
          db.from('league_players').select('player_id,player_name,positions,team_id').eq('league_id', leagueId).eq('player_id', playerId).maybeSingle(),
        ]);
        const host = await isLeagueHost(serviceSupabase, leagueId, user.id);
        if (!host && !ownedTeam) return NextResponse.json({ success: false, error: 'League member only' }, { status: 403 });
        if (!player) return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
        const { data: stats, error: statsError } = await db.from('player_match_stats')
          .select('*').eq('league_id', leagueId).eq('player_id', playerId).eq('engine_version', 'fc25-il-2');
        if (statsError) return NextResponse.json({ success: false, error: statsError.message }, { status: 500 });
        const matchIds = [...new Set((stats || []).map((row: any) => row.match_id))];
        const { data: matches } = matchIds.length ? await db.from('matches').select('id,season,competition_type,match_status,home_team_id,away_team_id').in('id', matchIds) : { data: [] };
        const matchMap = new Map((matches || []).map((match: any) => [match.id, match]));
        const groups = new Map<string, any>();
        for (const row of stats || []) {
          const match: any = matchMap.get(row.match_id);
          if (!match || Number(row.minutes || 0) < 15) continue;
          const competition = match.competition_type || 'domestic';
          const key = `${match.season}:${competition}:${row.team_id}`;
          const total = groups.get(key) || { season: match.season, competitionType: competition, teamId: row.team_id, appearances: 0, starts: 0, minutes: 0, ratingMinutes: 0, goals: 0, assists: 0, xg: 0, xa: 0, yellowCards: 0, redCards: 0 };
          total.appearances += 1; total.starts += row.starter ? 1 : 0; total.minutes += Number(row.minutes || 0);
          total.ratingMinutes += Number(row.rating || 0) * Number(row.minutes || 0);
          total.goals += Number(row.goals || 0); total.assists += Number(row.assists || 0);
          total.xg += Number(row.xg || 0); total.xa += Number(row.xa || 0);
          total.yellowCards += Number(row.yellow_cards || 0); total.redCards += Number(row.red_cards || 0);
          groups.set(key, total);
        }
        const history = [...groups.values()].map((total) => ({
          ...total,
          averageRating: total.minutes ? Number((total.ratingMinutes / total.minutes).toFixed(2)) : 0,
          per90: {
            goals: total.minutes ? Number((total.goals * 90 / total.minutes).toFixed(2)) : 0,
            assists: total.minutes ? Number((total.assists * 90 / total.minutes).toFixed(2)) : 0,
            xg: total.minutes ? Number((total.xg * 90 / total.minutes).toFixed(2)) : 0,
            xa: total.minutes ? Number((total.xa * 90 / total.minutes).toFixed(2)) : 0,
          },
        })).sort((a, b) => b.season - a.season || a.competitionType.localeCompare(b.competitionType));
        return NextResponse.json({ success: true, data: { player, engineVersion: 'fc25-il-2', history } });
      }

      case 'standings': {
        const season = searchParams.get('season');
        const { data: league } = await serviceSupabase
          .from('leagues')
          .select('season')
          .eq('id', leagueId)
          .single();

        const targetSeason = season ? parseInt(season) : league?.season || 1;

        const { data, error } = await serviceSupabase
          .from('standings')
          .select(`
            *,
            team:teams(id, name, acronym, logo_url)
          `)
          .eq('league_id', leagueId)
          .eq('season', targetSeason)
          .order('points', { ascending: false })
          .order('goal_diff', { ascending: false })
          .order('goals_for', { ascending: false });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'competition_standings': {
        const season = searchParams.get('season');
        const competitionType = searchParams.get('competitionType'); // ucl | uel | uecl
        const { data: league } = await serviceSupabase
          .from('leagues')
          .select('season')
          .eq('id', leagueId)
          .single();

        const targetSeason = season ? parseInt(season) : league?.season || 1;

        let query = serviceSupabase
          .from('competition_standings')
          .select(`
            *,
            team:teams(id, name, acronym, logo_url)
          `)
          .eq('league_id', leagueId)
          .eq('season', targetSeason);

        if (competitionType && ['ucl', 'uel', 'uecl'].includes(competitionType)) {
          query = query.eq('competition_type', competitionType);
        }

        const { data, error } = await query
          .order('group_name', { ascending: true })
          .order('points', { ascending: false })
          .order('goal_diff', { ascending: false })
          .order('goals_for', { ascending: false });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'schedule': {
        const season = searchParams.get('season');
        const round = searchParams.get('round');
        const roundFrom = searchParams.get('roundFrom') || searchParams.get('round_from');
        const roundTo = searchParams.get('roundTo') || searchParams.get('round_to');
        const competitionType = searchParams.get('competition_type') || searchParams.get('competitionType');
        const { data: league } = await serviceSupabase
          .from('leagues')
          .select('season, current_round, total_rounds')
          .eq('id', leagueId)
          .single();

        const targetSeason = season ? parseInt(season) : league?.season || 1;

        let query = serviceSupabase
          .from('matches')
          .select(`
            *,
            home_team:teams!matches_home_team_id_fkey(id, name, acronym, logo_url),
            away_team:teams!matches_away_team_id_fkey(id, name, acronym, logo_url)
          `)
          .eq('league_id', leagueId)
          .eq('season', targetSeason)
          .order('round', { ascending: true });

        if (round) {
          query = query.eq('round', parseInt(round));
        } else if (roundFrom || roundTo) {
          const from = roundFrom ? parseInt(roundFrom) : undefined;
          const to = roundTo ? parseInt(roundTo) : undefined;
          if (from != null) query = query.gte('round', from);
          if (to != null) query = query.lte('round', to);
        }

        if (competitionType) {
          if (['ucl', 'uel', 'uecl', 'supercup'].includes(competitionType)) {
            query = query.eq('competition_type', competitionType);
          } else if (competitionType === 'domestic') {
            query = query.or('competition_type.eq.domestic,competition_type.is.null');
          }
        }

        const { data, error } = await query;

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          data,
          meta: {
            current_round: league?.current_round,
            total_rounds: league?.total_rounds
          }
        });
      }

      case 'competition_winners': {
        const { data: uclRows } = await serviceSupabase
          .from('team_competition_results')
          .select('team_id, teams!inner(name, acronym, logo_url)')
          .eq('league_id', leagueId)
          .eq('stage', 'UCL Winners');
        const { data: uelRows } = await serviceSupabase
          .from('team_competition_results')
          .select('team_id, teams!inner(name, acronym, logo_url)')
          .eq('league_id', leagueId)
          .eq('stage', 'UEL Winners');
        const { data: ueclRows } = await serviceSupabase
          .from('team_competition_results')
          .select('team_id, teams!inner(name, acronym, logo_url)')
          .eq('league_id', leagueId)
          .eq('stage', 'UECL Winners');
        const { data: hofRows } = await serviceSupabase
          .from('hall_of_fame')
          .select('team_id, teams!inner(name, acronym, logo_url)')
          .eq('league_id', leagueId)
          .eq('position', 1);

        const countByTeam = (rows: { team_id: string; teams: { name: string; acronym: string; logo_url: string | null } }[] | null) => {
          const map = new Map<string, { count: number; team: { name: string; acronym: string; logo_url: string | null } }>();
          (rows || []).forEach((r) => {
            const cur = map.get(r.team_id);
            const team = r.teams as { name: string; acronym: string; logo_url: string | null };
            if (cur) {
              map.set(r.team_id, { count: cur.count + 1, team });
            } else {
              map.set(r.team_id, { count: 1, team });
            }
          });
          return Array.from(map.entries())
            .map(([team_id, v]) => ({ team_id, count: v.count, team: v.team }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);
        };

        return NextResponse.json({
          success: true,
          data: {
            ucl: countByTeam(uclRows as any),
            uel: countByTeam(uelRows as any),
            uecl: countByTeam(ueclRows as any),
            domestic: countByTeam(hofRows as any),
          },
        });
      }

      case 'audit_logs': {
        const { data, error } = await serviceSupabase
          .from('audit_logs')
          .select('*')
          .eq('league_id', leagueId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'league_info': {
        const { data: leagueRow, error } = await serviceSupabase
          .from('leagues')
          .select('*')
          .eq('id', leagueId)
          .single();

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        const season = leagueRow?.season ?? 1;
        const currentRoundUcl = leagueRow?.current_round_ucl ?? 0;
        const currentRoundUel = leagueRow?.current_round_uel ?? 0;
        const currentRoundUecl = leagueRow?.current_round_uecl ?? 0;

        const { count: unsimulatedCount } = await serviceSupabase
          .from('matches')
          .select('*', { count: 'exact', head: true })
          .eq('league_id', leagueId)
          .eq('season', season)
          .eq('match_status', 'scheduled');

        const [uclRes, uelRes, ueclRes, supercupRes, uclScheduledRes, uelScheduledRes, ueclScheduledRes, supercupScheduledRes] = await Promise.all([
          serviceSupabase.from('matches').select('id', { count: 'exact', head: true }).eq('league_id', leagueId).eq('season', season).eq('competition_type', 'ucl'),
          serviceSupabase.from('matches').select('id', { count: 'exact', head: true }).eq('league_id', leagueId).eq('season', season).eq('competition_type', 'uel'),
          serviceSupabase.from('matches').select('id', { count: 'exact', head: true }).eq('league_id', leagueId).eq('season', season).eq('competition_type', 'uecl'),
          serviceSupabase.from('matches').select('id', { count: 'exact', head: true }).eq('league_id', leagueId).eq('season', season).eq('competition_type', 'supercup').eq('match_status', 'scheduled'),
          serviceSupabase.from('matches').select('id', { count: 'exact', head: true }).eq('league_id', leagueId).eq('season', season).eq('competition_type', 'ucl').eq('round', currentRoundUcl || 1).eq('match_status', 'scheduled'),
          serviceSupabase.from('matches').select('id', { count: 'exact', head: true }).eq('league_id', leagueId).eq('season', season).eq('competition_type', 'uel').eq('round', currentRoundUel || 1).eq('match_status', 'scheduled'),
          serviceSupabase.from('matches').select('id', { count: 'exact', head: true }).eq('league_id', leagueId).eq('season', season).eq('competition_type', 'uecl').eq('round', currentRoundUecl || 1).eq('match_status', 'scheduled'),
          serviceSupabase.from('matches').select('id', { count: 'exact', head: true }).eq('league_id', leagueId).eq('season', season).eq('competition_type', 'supercup').eq('round', 1).eq('match_status', 'scheduled'),
        ]);

        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id);

        return NextResponse.json({
          success: true,
          data: {
            ...leagueRow,
            unsimulated_match_count: unsimulatedCount ?? 0,
            has_ucl_matches: (uclRes.count ?? 0) > 0,
            has_uel_matches: (uelRes.count ?? 0) > 0,
            has_uecl_matches: (ueclRes.count ?? 0) > 0,
            has_supercup_matches: (supercupRes.count ?? 0) > 0,
            scheduled_ucl_this_round: uclScheduledRes.count ?? 0,
            scheduled_uel_this_round: uelScheduledRes.count ?? 0,
            scheduled_uecl_this_round: ueclScheduledRes.count ?? 0,
            scheduled_supercup_this_round: supercupScheduledRes.count ?? 0,
            is_host: isHost,
          },
        });
      }

      case 'simulation_settings': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id);
        if (!isHost) return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        const { data, error } = await (serviceSupabase as any).from('simulation_settings').select('*').eq('league_id', leagueId).maybeSingle();
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        const row = data || { preset: 'balanced', ...applySimulationPreset('balanced') };
        return NextResponse.json({ success: true, data: row });
      }

      default:
        return NextResponse.json({ success: false, error: 'type parameter required (standings, schedule, audit_logs, league_info, competition_winners)' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Game API GET error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
