import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** GET /api/packs/odds?packId=X - Returns rating odds for a pack */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const packId = searchParams.get("packId");
    if (!packId) {
      return NextResponse.json({ error: "packId required" }, { status: 400 });
    }

    const { data: odds, error } = await supabase
      .from("pack_rating_odds")
      .select("rating, probability")
      .eq("pack_id", parseInt(packId, 10))
      .gt("probability", 0)
      .order("rating", { ascending: false });

    if (error) {
      console.error("Pack odds fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      odds: (odds || []).map((o) => ({
        rating: o.rating,
        probability: o.probability,
        pct: ((o.probability ?? 0) * 100).toFixed(1),
      })),
    });
  } catch (err: unknown) {
    console.error("Pack odds API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
