import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get("leagueId");

    if (!leagueId) {
      return NextResponse.json({ error: "League ID is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Fetch recent league events
    const { data: events, error } = await supabase
      .from("league_events")
      .select(`
        id,
        league_id,
        event_type,
        event_data,
        created_at,
        user_id,
        profiles!inner(username, full_name)
      `)
      .eq("league_id", leagueId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Error fetching league events:", error);
      // Return empty array instead of error for now
      return NextResponse.json({ success: true, events: [] });
    }

    // Process events to make them more readable
    const processedEvents = events?.map(event => {
      const profile = Array.isArray(event.profiles) ? event.profiles[0] : event.profiles;
      return {
        id: event.id,
        type: event.event_type,
        data: event.event_data,
        timestamp: event.created_at,
        user: (profile as { full_name?: string; username?: string } | null)?.full_name ||
          (profile as { full_name?: string; username?: string } | null)?.username ||
          "Unknown User"
      };
    }) || [];

    return NextResponse.json({ success: true, events: processedEvents });

  } catch (error: any) {
    console.error("League events API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 