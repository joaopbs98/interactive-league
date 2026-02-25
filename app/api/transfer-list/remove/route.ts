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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { listingId } = body;

    if (!listingId) {
      return NextResponse.json(
        { error: "listingId required" },
        { status: 400 }
      );
    }

    const serviceSupabase = await getServiceSupabase();

    const { data: listing, error: fetchErr } = await serviceSupabase
      .from("transfer_listings")
      .select("id, team_id")
      .eq("id", listingId)
      .single();

    if (fetchErr || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const { data: team } = await serviceSupabase
      .from("teams")
      .select("user_id")
      .eq("id", listing.team_id)
      .single();

    if (!team || team.user_id !== user.id) {
      return NextResponse.json({ error: "Only the listing owner can remove" }, { status: 403 });
    }

    const { error: deleteErr } = await serviceSupabase
      .from("transfer_listings")
      .delete()
      .eq("id", listingId);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Listing removed",
    });
  } catch (error: any) {
    console.error("Transfer list remove error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
