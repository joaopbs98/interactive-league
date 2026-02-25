import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { isLeagueHost } from "@/lib/hostUtils";

async function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** GET: Fetch free agents for a league (host only) */
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
    const leagueId = searchParams.get("leagueId");
    if (!leagueId) {
      return NextResponse.json({ error: "leagueId required" }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();
    const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id);
    if (!isHost) {
      return NextResponse.json({ error: "Host only" }, { status: 403 });
    }

    const { data: freeAgents, error } = await serviceSupabase
      .from("league_players")
      .select("id, player_id, player_name, full_name, positions, rating")
      .eq("league_id", leagueId)
      .is("team_id", null)
      .order("rating", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: freeAgents || [] });
  } catch (err: unknown) {
    console.error("Add player to team GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
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
    const { leagueId, teamId, playerId, customPlayer } = body;

    if (!leagueId || !teamId) {
      return NextResponse.json(
        { error: "leagueId and teamId required" },
        { status: 400 }
      );
    }

    const serviceSupabase = await getServiceSupabase();
    const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id);
    if (!isHost) {
      return NextResponse.json({ error: "Host only" }, { status: 403 });
    }

    // Verify team belongs to league
    const { data: team, error: teamErr } = await serviceSupabase
      .from("teams")
      .select("id")
      .eq("id", teamId)
      .eq("league_id", leagueId)
      .single();
    if (teamErr || !team) {
      return NextResponse.json({ error: "Team not found in league" }, { status: 400 });
    }

    const { data: league } = await serviceSupabase
      .from("leagues")
      .select("season")
      .eq("id", leagueId)
      .single();
    const season = league?.season ?? 1;

    if (customPlayer) {
      // Add custom player: create in player, league_players, contracts
      const {
        name,
        fullName,
        positions,
        rating,
        wage,
        internationalReputation,
        nationality,
        dob,
        heightCm,
        weightKg,
        value: customValue,
        preferredFoot,
        skillMoves,
        weakFoot,
        bodyType,
        potential,
        stats: customStats,
      } = customPlayer;
      if (!name || !positions || rating == null || wage == null) {
        return NextResponse.json(
          { error: "customPlayer requires: name, positions, rating, wage" },
          { status: 400 }
        );
      }
      const r = Math.min(99, Math.max(40, parseInt(String(rating), 10) || 50));
      const w = Math.max(0, parseInt(String(wage), 10) || 500000);
      const ir = String(
        Math.min(5, Math.max(1, parseInt(String(internationalReputation || 1), 10) || 1))
      );

      const newPlayerId = `custom_${randomUUID().replace(/-/g, "")}`;
      const displayName = (fullName || name).trim() || name;
      const pos = String(positions).trim() || "CM";

      const playerInsert: Record<string, unknown> = {
        player_id: newPlayerId,
        name: name.trim(),
        full_name: displayName,
        positions: pos,
        overall_rating: r,
        international_reputation: ir,
      };
      if (nationality != null && String(nationality).trim()) playerInsert.country_name = String(nationality).trim();
      if (dob != null && String(dob).trim()) playerInsert.dob = String(dob).trim();
      if (heightCm != null && String(heightCm).trim()) playerInsert.height_cm = String(heightCm).trim();
      if (weightKg != null && String(weightKg).trim()) playerInsert.weight_kg = String(weightKg).trim();
      if (customValue != null && !isNaN(Number(customValue))) playerInsert.value = String(customValue);
      if (preferredFoot != null && String(preferredFoot).trim()) playerInsert.preferred_foot = String(preferredFoot).trim();
      if (skillMoves != null && String(skillMoves).trim()) playerInsert.skill_moves = String(skillMoves).trim();
      if (weakFoot != null && String(weakFoot).trim()) playerInsert.weak_foot = String(weakFoot).trim();
      if (bodyType != null && String(bodyType).trim()) playerInsert.body_type = String(bodyType).trim();
      if (potential != null && typeof potential === "number" && potential >= 40 && potential <= 99) {
        playerInsert.potential = potential;
      }

      const statColumns = ["acceleration", "sprint_speed", "agility", "reactions", "balance", "shot_power", "jumping", "stamina", "strength", "long_shots", "aggression", "interceptions", "positioning", "vision", "penalties", "composure", "crossing", "finishing", "heading_accuracy", "short_passing", "volleys", "dribbling", "curve", "fk_accuracy", "long_passing", "ball_control", "defensive_awareness", "standing_tackle", "sliding_tackle", "gk_diving", "gk_handling", "gk_kicking", "gk_positioning", "gk_reflexes"] as const;
      if (customStats && typeof customStats === "object") {
        for (const key of statColumns) {
          const v = (customStats as Record<string, unknown>)[key];
          if (typeof v === "number" && v >= 1 && v <= 99) {
            playerInsert[key] = v;
          }
        }
      }

      const { error: playerErr } = await serviceSupabase.from("player").insert(playerInsert);

      if (playerErr) {
        return NextResponse.json(
          { error: `Failed to create player: ${playerErr.message}` },
          { status: 500 }
        );
      }

      const lpInsert: Record<string, unknown> = {
        league_id: leagueId,
        player_id: newPlayerId,
        player_name: displayName,
        full_name: displayName,
        positions: pos,
        rating: r,
        team_id: teamId,
        origin_type: "signed",
      };
      if (potential != null && typeof potential === "number" && potential >= 40 && potential <= 99) {
        lpInsert.potential = potential;
      }
      if (customStats && typeof customStats === "object") {
        for (const key of statColumns) {
          const v = (customStats as Record<string, unknown>)[key];
          if (typeof v === "number" && v >= 1 && v <= 99) {
            lpInsert[key] = v;
          }
        }
      }

      const { error: lpErr } = await serviceSupabase
        .from("league_players")
        .upsert(lpInsert, { onConflict: "league_id,player_id" });

      if (lpErr) {
        return NextResponse.json(
          { error: `Failed to add to league: ${lpErr.message}` },
          { status: 500 }
        );
      }

      const { error: contractErr } = await serviceSupabase
        .from("contracts")
        .upsert(
          {
            team_id: teamId,
            player_id: newPlayerId,
            wage: w,
            start_season: season,
            years: 3,
          },
          { onConflict: "team_id,player_id" }
        );

      if (contractErr) {
        return NextResponse.json(
          { error: `Failed to create contract: ${contractErr.message}` },
          { status: 500 }
        );
      }

      await serviceSupabase.rpc("write_audit_log", {
        p_league_id: leagueId,
        p_action: "host_add_player",
        p_actor_id: user.id,
        p_payload: {
          team_id: teamId,
          player_id: newPlayerId,
          player_name: displayName,
          custom: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: { playerId: newPlayerId, playerName: displayName, custom: true },
      });
    }

    if (playerId) {
      // Assign free agent to team
      const { data: fa, error: faErr } = await serviceSupabase
        .from("league_players")
        .select("id, player_id, player_name")
        .eq("league_id", leagueId)
        .eq("player_id", playerId)
        .is("team_id", null)
        .single();

      if (faErr || !fa) {
        return NextResponse.json(
          { error: "Player not found as free agent in this league" },
          { status: 400 }
        );
      }

      const { error: updateErr } = await serviceSupabase
        .from("league_players")
        .update({ team_id: teamId })
        .eq("id", fa.id);

      if (updateErr) {
        return NextResponse.json(
          { error: `Failed to assign: ${updateErr.message}` },
          { status: 500 }
        );
      }

      // Ensure contract exists (wage from body or default)
      const wage = Math.max(0, parseInt(String(body.wage), 10) || 500000);
      await serviceSupabase.from("contracts").upsert(
        {
          team_id: teamId,
          player_id: playerId,
          wage,
          start_season: season,
          years: 3,
        },
        { onConflict: "team_id,player_id" }
      );

      await serviceSupabase.rpc("write_audit_log", {
        p_league_id: leagueId,
        p_action: "host_add_player",
        p_actor_id: user.id,
        p_payload: {
          team_id: teamId,
          player_id: playerId,
          player_name: fa.player_name,
          custom: false,
        },
      });

      return NextResponse.json({
        success: true,
        data: { playerId, playerName: fa.player_name, custom: false },
      });
    }

    return NextResponse.json(
      { error: "Provide either playerId (free agent) or customPlayer" },
      { status: 400 }
    );
  } catch (err: unknown) {
    console.error("Add player to team API error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
