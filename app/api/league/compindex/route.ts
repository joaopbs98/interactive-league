import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

async function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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

    if (!leagueId) {
      return NextResponse.json({ success: false, error: 'leagueId required' }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();

    const { data: teams, error: teamsError } = await serviceSupabase
      .from('teams')
      .select('id, name, acronym, comp_index')
      .eq('league_id', leagueId)
      .order('comp_index', { ascending: false, nullsFirst: false });

    if (teamsError) {
      return NextResponse.json({ success: false, error: teamsError.message }, { status: 500 });
    }

    const { data: hofRows, error: hofError } = await serviceSupabase
      .from('hall_of_fame')
      .select('team_id, season, position, hof_points')
      .eq('league_id', leagueId)
      .order('season', { ascending: true });

    if (hofError) {
      return NextResponse.json({ success: false, error: hofError.message }, { status: 500 });
    }

    const hofByTeam = new Map<string, { hof_overall: number; hof_last_3: number }>();
    for (const row of hofRows || []) {
      const teamId = row.team_id as string;
      if (!hofByTeam.has(teamId)) {
        hofByTeam.set(teamId, { hof_overall: 0, hof_last_3: 0 });
      }
      const entry = hofByTeam.get(teamId)!;
      const points = row.hof_points as number;
      entry.hof_overall += points;
    }

    const seasonsByTeam = new Map<string, { season: number; points: number }[]>();
    for (const row of hofRows || []) {
      const teamId = row.team_id as string;
      if (!seasonsByTeam.has(teamId)) {
        seasonsByTeam.set(teamId, []);
      }
      seasonsByTeam.get(teamId)!.push({
        season: row.season as number,
        points: row.hof_points as number,
      });
    }

    for (const [teamId, seasons] of seasonsByTeam) {
      const last3 = seasons.slice(-3);
      const hofLast3 = last3.reduce((s, x) => s + x.points, 0);
      const entry = hofByTeam.get(teamId);
      if (entry) entry.hof_last_3 = hofLast3;
    }

    const compIndexes = (teams || []).map((t) => t.comp_index ?? 0).filter((c) => c > 0);
    const leagueAvg = compIndexes.length > 0
      ? compIndexes.reduce((a, b) => a + b, 0) / compIndexes.length
      : 0;
    const THRESHOLD = 1.0;

    function getCompIndexStatus(compIndex: number): string {
      if (compIndex === 0) return 'N/A';
      const gap = compIndex - leagueAvg;
      if (gap > THRESHOLD) return 'Above average';
      if (gap >= -THRESHOLD && gap <= THRESHOLD) return 'Inside average';
      if (gap < -THRESHOLD * 2) return 'Critical';
      return 'Below average';
    }

    const result = (teams || []).map((t) => {
      const hof = hofByTeam.get(t.id) || { hof_overall: 0, hof_last_3: 0 };
      const compIndex = t.comp_index ?? 0;
      return {
        team_id: t.id,
        team_name: t.name,
        acronym: t.acronym,
        comp_index: compIndex,
        hof_overall: hof.hof_overall,
        hof_last_3: hof.hof_last_3,
        situation: getCompIndexStatus(compIndex),
      };
    });

    return NextResponse.json({ success: true, data: result, league_avg: leagueAvg });
  } catch (error: any) {
    console.error('CompIndex API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
