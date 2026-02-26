import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const TRANSFER_REASONS = new Set([
  "Transfer In",
  "Transfer Out",
  "Pack Purchase",
  "Signing Bonus",
  "Transfer List Purchase",
  "Transfer List Sale",
  "Trade Bonus",
]);

export async function GET(request: NextRequest) {
  try {
    const teamId = request.nextUrl.pathname.split("/")[3];
    if (!teamId) {
      return NextResponse.json({ error: "Team ID required" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const seasonParam = searchParams.get("season");
    const typeFilter = searchParams.get("type"); // "in" | "out" | "all"
    const search = (searchParams.get("search") || "").trim().toLowerCase();

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, user_id")
      .eq("id", teamId)
      .single();

    if (teamError || !team || team.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let query = supabase
      .from("finances")
      .select("id, amount, reason, description, season, date, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (seasonParam) {
      const season = parseInt(seasonParam, 10);
      if (!isNaN(season)) query = query.eq("season", season);
    }

    const { data: rows, error } = await query.limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filteredRows = (rows ?? []).filter((r: { reason: string | null }) =>
      r.reason && TRANSFER_REASONS.has(r.reason)
    );

    let items = filteredRows.map((r: { id: string; amount: number; reason: string | null; description: string | null; season: number; date: string; created_at: string }) => ({
      id: r.id,
      date: r.created_at,
      type: mapReasonToType(r.reason),
      reason: r.reason,
      amount: r.amount,
      direction: r.amount >= 0 ? "in" as const : "out" as const,
      playerName: extractPlayerFromDescription(r.description),
      description: r.description,
      season: r.season,
    }));

    if (typeFilter === "in") {
      items = items.filter((i) => i.direction === "in");
    } else if (typeFilter === "out") {
      items = items.filter((i) => i.direction === "out");
    }

    if (search) {
      items = items.filter(
        (i) =>
          (i.playerName && i.playerName.toLowerCase().includes(search)) ||
          (i.description && i.description.toLowerCase().includes(search))
      );
    }

    const totalReceived = items.filter((i) => i.direction === "in").reduce((s, i) => s + i.amount, 0);
    const totalSpent = items.filter((i) => i.direction === "out").reduce((s, i) => s + Math.abs(i.amount), 0);
    const net = totalReceived - totalSpent;

    return NextResponse.json({
      success: true,
      data: {
        items,
        summary: { totalReceived, totalSpent, net },
      },
    });
  } catch (err) {
    console.error("Transfer history error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

function mapReasonToType(reason: string | null): string {
  if (!reason) return "Other";
  const map: Record<string, string> = {
    "Transfer In": "Transfer",
    "Transfer Out": "Transfer",
    "Pack Purchase": "Pack",
    "Signing Bonus": "Free Agent",
    "Transfer List Purchase": "Transfer List",
    "Transfer List Sale": "Transfer List",
    "Trade Bonus": "Trade",
  };
  return map[reason] ?? reason;
}

function extractPlayerFromDescription(desc: string | null): string | null {
  if (!desc) return null;
  const m = desc.match(/Signed\s+(.+?)\s+from|signed\s+(.+?)\s+from|Player:\s*(.+?)(?:\s|$|,)/i);
  if (m) return (m[1] || m[2] || m[3] || "").trim() || null;
  return null;
}
