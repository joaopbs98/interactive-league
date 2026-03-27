import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { count } = await serviceSupabase
      .from("packs")
      .select("*", { count: "exact", head: true });

    if ((count || 0) > 0) {
      return NextResponse.json({
        success: true,
        message: "Packs already populated",
        count,
      });
    }

    const { error } = await serviceSupabase.from("packs").insert([
      { name: "S1 Basic", price: 8000000, player_count: 3, season: 1, pack_type: "Basic", description: "Basic pack for Season 1" },
      { name: "S1 Prime", price: 14000000, player_count: 3, season: 1, pack_type: "Prime", description: "Prime pack for Season 1" },
      { name: "S1 Elite", price: 20000000, player_count: 3, season: 1, pack_type: "Elite", description: "Elite pack for Season 1" },
      { name: "S2 Basic", price: 9000000, player_count: 3, season: 2, pack_type: "Basic", description: "Basic pack for Season 2" },
      { name: "S2 Prime", price: 15250000, player_count: 3, season: 2, pack_type: "Prime", description: "Prime pack for Season 2" },
      { name: "S2 Elite", price: 22000000, player_count: 3, season: 2, pack_type: "Elite", description: "Elite pack for Season 2" },
    ]);

    if (error) {
      console.error("Populate packs error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Packs populated successfully",
    });
  } catch (error: any) {
    console.error("Populate packs API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
