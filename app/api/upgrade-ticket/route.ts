import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

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
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { ticketId, playerId } = body;

    if (!ticketId || !playerId) {
      return NextResponse.json({ success: false, error: "ticketId and playerId required" }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();
    const { data, error } = await serviceSupabase.rpc("use_upgrade_ticket", {
      p_ticket_id: ticketId,
      p_player_id: playerId,
      p_actor_user_id: user.id,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const result = data as { success: boolean; error?: string; rating_boost?: number; player_id?: string };
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error ?? "Failed to use ticket" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: { rating_boost: result.rating_boost, player_id: result.player_id },
    });
  } catch (err) {
    console.error("Upgrade ticket error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
