import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const season = searchParams.get("season");

    let query = supabase.from("packs").select("*").order("season", { ascending: true }).order("pack_type", { ascending: true });

    if (season) {
      const seasonNum = parseInt(season, 10);
      if (!isNaN(seasonNum)) {
        query = query.eq("season", seasonNum);
      }
    }

    const { data: packs, error } = await query;

    if (error) {
      console.error("Packs fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ packs: packs || [] });
  } catch (error: any) {
    console.error("Debug packs API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
