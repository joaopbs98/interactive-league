import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { isLeagueHost } from '@/lib/hostUtils';

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
    const { data, error } = await serviceSupabase
      .from('leagues')
      .select('match_mode, transfer_window_open')
      .eq('id', leagueId)
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const isHost = user ? await isLeagueHost(serviceSupabase, leagueId, user.id) : false;

    return NextResponse.json({
      success: true,
      data: {
        match_mode: data?.match_mode ?? 'SIMULATED',
        transfer_window_open: data?.transfer_window_open ?? true,
        is_host: isHost
      }
    });
  } catch (error: any) {
    console.error('League settings GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { leagueId, match_mode, transfer_window_open } = body;

    if (!leagueId) {
      return NextResponse.json({ success: false, error: 'leagueId required' }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();
    const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id);
    if (!isHost) {
      return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof match_mode === 'string' && ['SIMULATED', 'MANUAL'].includes(match_mode)) {
      updates.match_mode = match_mode;
    }
    if (typeof transfer_window_open === 'boolean') {
      updates.transfer_window_open = transfer_window_open;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid updates to apply' }, { status: 400 });
    }

    const { error: updateError } = await serviceSupabase
      .from('leagues')
      .update(updates)
      .eq('id', leagueId);

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: updates });
  } catch (error: any) {
    console.error('League settings PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
