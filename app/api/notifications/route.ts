import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

async function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** GET: Fetch notifications for current user, optionally filtered by leagueId. Creates new ones based on conditions. */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get("leagueId");

    const serviceSupabase = await getServiceSupabase();

    // Ensure notifications exist for user's teams (create on-demand)
    const { data: userTeams } = await serviceSupabase
      .from("teams")
      .select("id, league_id")
      .eq("user_id", user.id);

    if (userTeams?.length) {
      for (const team of userTeams) {
        const lid = team.league_id;
        if (!lid) continue;

        const { data: league } = await serviceSupabase
          .from("leagues")
          .select("status")
          .eq("id", lid)
          .single();

        const { data: teamRow } = await serviceSupabase
          .from("teams")
          .select("sponsor_id")
          .eq("id", team.id)
          .single();

        if (league?.status === "OFFSEASON" && !teamRow?.sponsor_id) {
          const { data: existing } = await serviceSupabase
            .from("notifications")
            .select("id")
            .eq("user_id", user.id)
            .eq("league_id", lid)
            .eq("team_id", team.id)
            .eq("type", "pick_sponsor")
            .limit(1)
            .maybeSingle();

          if (!existing) {
            await serviceSupabase.from("notifications").insert({
              user_id: user.id,
              league_id: lid,
              team_id: team.id,
              type: "pick_sponsor",
              title: "Pick a sponsor",
              message: "Your team has no sponsor. Sign one during OFFSEASON to receive payments.",
              read: false,
              link: "/main/dashboard/sponsors",
            });
          }
        }

        const { data: contracts } = await serviceSupabase
          .from("contracts")
          .select("player_id")
          .eq("team_id", team.id)
          .eq("status", "active")
          .lte("years", 1);

        if (contracts?.length && contracts.length > 0) {
          const { data: existingContract } = await serviceSupabase
            .from("notifications")
            .select("id")
            .eq("user_id", user.id)
            .eq("league_id", lid)
            .eq("team_id", team.id)
            .eq("type", "contract_ending")
            .limit(1)
            .maybeSingle();

          if (!existingContract) {
            await serviceSupabase.from("notifications").insert({
              user_id: user.id,
              league_id: lid,
              team_id: team.id,
              type: "contract_ending",
              title: "Contracts ending soon",
              message: `${contracts.length} player(s) have 1 season or less on their contract.`,
              read: false,
              link: "/main/dashboard/contracts",
            });
          }
        }

        let reg: { valid?: boolean } | null = null;
        try {
          const regResult = await serviceSupabase.rpc("validate_squad_registration", {
            p_league_id: lid,
            p_team_id: team.id,
          });
          reg = regResult.data as { valid?: boolean } | null;
        } catch {
          // ignore RPC errors
        }
        if (reg && reg.valid === false && league?.status !== "IN_SEASON") {
          const { data: existingReg } = await serviceSupabase
            .from("notifications")
            .select("id")
            .eq("user_id", user.id)
            .eq("league_id", lid)
            .eq("team_id", team.id)
            .eq("type", "registration_required")
            .limit(1)
            .maybeSingle();

          if (!existingReg) {
            await serviceSupabase.from("notifications").insert({
              user_id: user.id,
              league_id: lid,
              team_id: team.id,
              type: "registration_required",
              title: "Registration required",
              message: "Your squad must have 21–23 players (max 3 GKs) before the season starts.",
              read: false,
              link: "/main/dashboard/squad",
            });
          }
        }
      }
    }

    let query = serviceSupabase
      .from("notifications")
      .select("id, league_id, team_id, type, title, message, read, created_at, link")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (leagueId) {
      query = query.eq("league_id", leagueId);
    }

    const { data: notifications, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      notifications: notifications || [],
      unreadCount: (notifications || []).filter((n) => !n.read).length,
    });
  } catch (err: unknown) {
    console.error("Notifications API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/** PATCH: Mark notification(s) as read */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { ids, markAllRead } = body;

    if (markAllRead) {
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .in("id", ids);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Notifications PATCH error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
