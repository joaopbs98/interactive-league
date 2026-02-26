import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

async function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { leagueId } = body;

    if (!leagueId) {
      return NextResponse.json({ error: "leagueId required" }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();
    const { data, error } = await serviceSupabase.rpc("delete_league", {
      p_league_id: leagueId,
      p_actor_user_id: user.id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data?.success) {
      return NextResponse.json({ error: data?.error ?? "Failed to delete league" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    console.error("Delete league API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
