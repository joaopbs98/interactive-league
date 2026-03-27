import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isLeagueHost } from "@/lib/hostUtils";

async function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** GET: Fetch draft pool for league, or search global players for host to add. */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get("leagueId");
    const search = searchParams.get("search") || "";
    const mode = searchParams.get("mode");

    if (!leagueId) {
      return NextResponse.json({ error: "leagueId required" }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();
    const { data: league } = await serviceSupabase
      .from("leagues")
      .select("season")
      .eq("id", leagueId)
      .single();
    const season = league?.season ?? 1;

    if (mode === "search") {
      const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id);
      if (!isHost) {
        return NextResponse.json({ error: "Host only" }, { status: 403 });
      }
      let q = serviceSupabase
        .from("player")
        .select("player_id, name, full_name, positions, overall_rating")
        .order("overall_rating", { ascending: false })
        .limit(50);
      if (search.trim()) {
        q = q.ilike("name", `%${search.trim()}%`);
      }
      const { data: players, error: searchErr } = await q;
      if (searchErr) {
        return NextResponse.json({ error: searchErr.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: players || [] });
    }

    const { data: pool, error } = await serviceSupabase
      .from("draft_pool")
      .select("player_id")
      .eq("league_id", leagueId)
      .eq("season", season);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const poolIds = (pool || []).map((p) => p.player_id);
    let poolDetails: { player_id: string; player_name?: string; rating?: number }[] = poolIds as unknown as { player_id: string }[];
    if (poolIds.length > 0) {
      const { data: lp } = await serviceSupabase
        .from("league_players")
        .select("player_id, player_name, rating")
        .eq("league_id", leagueId)
        .in("player_id", poolIds);
      const map = new Map((lp || []).map((r) => [r.player_id, r]));
      poolDetails = poolIds.map((id) => ({ player_id: id, ...map.get(id) }));
    }

    return NextResponse.json({
      success: true,
      data: poolIds,
      poolDetails,
    });
  } catch (err: unknown) {
    console.error("Draft pool GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/** POST: Add/remove players from draft pool. Host only. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, leagueId, playerIds } = body;

    if (!leagueId) {
      return NextResponse.json({ error: "leagueId required" }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();
    const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id);
    if (!isHost) {
      return NextResponse.json({ error: "Host only" }, { status: 403 });
    }

    const { data: league } = await serviceSupabase
      .from("leagues")
      .select("season")
      .eq("id", leagueId)
      .single();
    const season = league?.season ?? 1;

    if (action === "add") {
      const ids = Array.isArray(playerIds) ? playerIds : [playerIds].filter(Boolean);
      if (ids.length === 0) {
        return NextResponse.json({ error: "playerIds required" }, { status: 400 });
      }

      for (const playerId of ids) {
        const { data: p } = await serviceSupabase
          .from("player")
          .select("player_id, name, full_name, image, description, positions, overall_rating")
          .eq("player_id", playerId)
          .single();

        if (!p) {
          return NextResponse.json({ error: `Player ${playerId} not found in global DB` }, { status: 400 });
        }

        const { data: existing } = await serviceSupabase
          .from("league_players")
          .select("id, team_id")
          .eq("league_id", leagueId)
          .eq("player_id", playerId)
          .single();

        if (!existing) {
          const { error: insErr } = await serviceSupabase.from("league_players").upsert(
            {
              league_id: leagueId,
              player_id: p.player_id,
              player_name: p.name ?? p.player_id,
              full_name: p.full_name,
              image: p.image,
              description: p.description,
              positions: p.positions ?? "ST",
              rating: p.overall_rating ?? 50,
              team_id: null,
            },
            { onConflict: "league_id,player_id", ignoreDuplicates: true }
          );
          if (insErr) {
            return NextResponse.json({ error: `Failed to add player: ${insErr.message}` }, { status: 500 });
          }
        } else if (existing.team_id) {
          return NextResponse.json({ error: `Player ${playerId} is already on a team` }, { status: 400 });
        }

        await serviceSupabase.from("draft_pool").upsert(
          {
            league_id: leagueId,
            season,
            player_id: playerId,
            added_by_host: user.id,
          },
          { onConflict: "league_id,season,player_id" }
        );
      }
      return NextResponse.json({ success: true, message: `Added ${ids.length} player(s) to draft pool` });
    }

    if (action === "remove") {
      const ids = Array.isArray(playerIds) ? playerIds : [playerIds].filter(Boolean);
      if (ids.length === 0) {
        return NextResponse.json({ error: "playerIds required" }, { status: 400 });
      }
      const { error: delErr } = await serviceSupabase
        .from("draft_pool")
        .delete()
        .eq("league_id", leagueId)
        .eq("season", season)
        .in("player_id", ids);
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: `Removed ${ids.length} player(s) from draft pool` });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("Draft pool POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
