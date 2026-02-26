import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId } = body;

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    const { data: team } = await supabase
      .from('teams')
      .select('user_id')
      .eq('id', teamId)
      .single();
    if (!team || team.user_id !== user.id) {
      return NextResponse.json({ error: 'Team not found or you do not own this team' }, { status: 403 });
    }

    // Call the leave_league function
    const { data: result, error: leaveError } = await supabase
      .rpc('leave_league', {
        p_team_id: teamId
      });

    console.log('Leave League API: Result:', { result, leaveError });

    if (leaveError) {
      console.error('Leave League API: Error leaving league:', leaveError);
      throw leaveError;
    }

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Failed to leave league' 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Leave League API: Error:', error);
    return NextResponse.json({ 
      error: 'Failed to leave league',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 