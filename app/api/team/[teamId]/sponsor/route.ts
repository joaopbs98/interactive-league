import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { teamId } = await params;
    const body = await request.json();
    const { sponsorId } = body;

    if (sponsorId !== null && typeof sponsorId !== "string") {
      return NextResponse.json({ error: "Invalid sponsorId" }, { status: 400 });
    }

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, league_id")
      .eq("id", teamId)
      .eq("user_id", session.user.id)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: "Team not found or access denied" }, { status: 404 });
    }

    const { data: league, error: leagueError } = await supabase
      .from("leagues")
      .select("status, season")
      .eq("id", team.league_id)
      .single();

    if (leagueError || !league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    if (league.status !== "OFFSEASON") {
      return NextResponse.json(
        { error: "Sponsor changes are only allowed during OFFSEASON" },
        { status: 400 }
      );
    }

    const season = league.season ?? 1;
    const contractStartSeasons = [2, 5, 7, 9];
    if (sponsorId && !contractStartSeasons.includes(season)) {
      return NextResponse.json(
        { error: "New sponsors can only be signed in contract-start seasons (S2, S5, S7, S9)" },
        { status: 400 }
      );
    }

    if (sponsorId) {
      const { data: sponsor } = await supabase
        .from("sponsors")
        .select("id")
        .eq("id", sponsorId)
        .single();

      if (!sponsor) {
        return NextResponse.json({ error: "Sponsor not found" }, { status: 400 });
      }

      // Get base payment and payout_type for current season (sponsor_season_terms or sponsors fallback)
      const { data: term } = await supabase
        .from("sponsor_season_terms")
        .select("base_payment, payout_type")
        .eq("sponsor_id", sponsorId)
        .eq("season", season)
        .maybeSingle();

      let basePayment = term?.base_payment ?? 0;
      const payoutType = term?.payout_type ?? "fixed";
      if (basePayment === 0) {
        const { data: sponsorRow } = await supabase
          .from("sponsors")
          .select("base_payment")
          .eq("id", sponsorId)
          .single();
        basePayment = sponsorRow?.base_payment ?? 0;
      }

      // Pay upfront only for fixed payout (performance_tier paid at end_season when results known)
      if (basePayment > 0 && payoutType === "fixed") {
        const serviceSupabase = createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { error: financeError } = await serviceSupabase.rpc("write_finance_entry", {
          p_team_id: teamId,
          p_league_id: team.league_id,
          p_amount: basePayment,
          p_reason: "Sponsor Payment",
          p_description: `Sponsor base payment season ${season} (upfront)`,
          p_season: season,
        });
        if (financeError) {
          console.error("Sponsor upfront payment error:", financeError);
          return NextResponse.json(
            { error: "Failed to apply sponsor payment" },
            { status: 500 }
          );
        }
      }
    }

    if (!sponsorId) {
      const { data: currentTeam } = await supabase
        .from("teams")
        .select("sponsor_id")
        .eq("id", teamId)
        .single();

      if (currentTeam?.sponsor_id) {
        const { data: term } = await supabase
          .from("sponsor_season_terms")
          .select("base_payment")
          .eq("sponsor_id", currentTeam.sponsor_id)
          .eq("season", season)
          .maybeSingle();

        let amount = term?.base_payment ?? 0;
        if (amount === 0) {
          const { data: sponsor } = await supabase
            .from("sponsors")
            .select("base_payment")
            .eq("id", currentTeam.sponsor_id)
            .single();
          amount = sponsor?.base_payment ?? 0;
        }

        if (amount > 0) {
          await supabase.rpc("deduct_sponsor_on_removal", {
            p_team_id: teamId,
            p_league_id: team.league_id,
            p_amount: amount,
            p_season: season,
          });
        }
      }
    }

    const contractEndsSeason =
      season === 2 ? 4 : [5, 7, 9].includes(season) ? season + 1 : season + 1;

    const updatePayload: {
      sponsor_id: string | null;
      sponsor_signed_at_season?: number | null;
      sponsor_contract_ends_season?: number | null;
    } = {
      sponsor_id: sponsorId || null,
    };
    if (sponsorId) {
      updatePayload.sponsor_signed_at_season = season;
      updatePayload.sponsor_contract_ends_season = contractEndsSeason;
    } else {
      updatePayload.sponsor_signed_at_season = null;
      updatePayload.sponsor_contract_ends_season = null;
    }

    const { error: updateError } = await supabase
      .from("teams")
      .update(updatePayload)
      .eq("id", teamId);

    if (updateError) {
      console.error("Error updating sponsor:", updateError);
      return NextResponse.json({ error: "Failed to update sponsor" }, { status: 500 });
    }

    return NextResponse.json({ success: true, sponsorId: sponsorId || null });
  } catch (err: unknown) {
    console.error("Team sponsor API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
