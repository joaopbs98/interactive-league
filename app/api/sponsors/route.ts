import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get("leagueId");

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (leagueId) {
      const { data: league } = await serviceSupabase
        .from("leagues")
        .select("season")
        .eq("id", leagueId)
        .single();
      const season = league?.season ?? 1;

      const { data: leagueSponsorRows } = await serviceSupabase
        .from("league_sponsors")
        .select("sponsor_id, sort_order")
        .eq("league_id", leagueId)
        .eq("season", season)
        .order("sort_order", { ascending: true });

      if (leagueSponsorRows && leagueSponsorRows.length > 0) {
        const sponsorIds = leagueSponsorRows.map((r) => r.sponsor_id);
        const { data: sponsors, error } = await serviceSupabase
          .from("sponsors")
          .select("id, name, base_payment, bonus_amount, bonus_condition, contract_start_seasons")
          .in("id", sponsorIds);
        if (error) {
          console.error("Error fetching league sponsors:", error);
          return NextResponse.json({ error: "Failed to fetch sponsors" }, { status: 500 });
        }

        const contractWindow =
          season <= 4 ? [2, 3, 4] : season <= 6 ? [5, 6] : season <= 8 ? [7, 8] : season <= 10 ? [9, 10] : [season];
        const contractLabel =
          season <= 4 ? "S2–S4 (3 seasons)" : season <= 6 ? "S5–S6 (2 seasons)" : season <= 8 ? "S7–S8 (2 seasons)" : "S9–S10 (2 seasons)";

        const { data: allTerms } = await serviceSupabase
          .from("sponsor_season_terms")
          .select("sponsor_id, season, base_payment, bonus_amount, bonus_condition_code, bonus_merch_pct, payout_type, transfer_request_count, transfer_request_rank, merch_modifier, repayment_penalty")
          .in("sponsor_id", sponsorIds)
          .in("season", contractWindow);

        const { data: termIds } = await serviceSupabase
          .from("sponsor_season_terms")
          .select("id, sponsor_id, season")
          .in("sponsor_id", sponsorIds)
          .in("season", contractWindow);

        const termIdMap = new Map<string, string>();
        (termIds || []).forEach((t) => termIdMap.set(`${t.sponsor_id}-${t.season}`, t.id));

        const { data: tiers } = termIdMap.size > 0
          ? await serviceSupabase
              .from("sponsor_payout_tiers")
              .select("sponsor_season_term_id, competition, stage_pattern, payout_amount, merch_modifier, transfer_request_count, transfer_request_rank")
              .in("sponsor_season_term_id", Array.from(termIdMap.values()))
          : { data: [] };

        const termMap = new Map<string, NonNullable<typeof allTerms>[number]>();
        (allTerms || []).forEach((t) => termMap.set(`${t.sponsor_id}-${t.season}`, t));

        type TierRow = { sponsor_season_term_id: string; competition: string; stage_pattern: string; payout_amount: number; merch_modifier: number; transfer_request_count: number; transfer_request_rank: number };
        const tierMap = new Map<string, TierRow[]>();
        (tiers || []).forEach((t: TierRow) => {
          const key = t.sponsor_season_term_id;
          if (!tierMap.has(key)) tierMap.set(key, []);
          tierMap.get(key)!.push(t);
        });

        const enriched = (sponsors || []).map((s) => {
          const currentTerm = termMap.get(`${s.id}-${season}`);
          const seasonTerms = contractWindow.map((seas) => {
            const t = termMap.get(`${s.id}-${seas}`);
            if (!t) return null;
            const termId = termIdMap.get(`${s.id}-${seas}`);
            const tierList = termId ? tierMap.get(termId) || [] : [];
            return {
              season: seas,
              base_payment: t.base_payment,
              bonus_amount: t.bonus_amount,
              bonus_condition_code: t.bonus_condition_code,
              bonus_merch_pct: t.bonus_merch_pct,
              payout_type: t.payout_type,
              transfer_request_count: t.transfer_request_count,
              transfer_request_rank: t.transfer_request_rank,
              merch_modifier: t.merch_modifier,
              repayment_penalty: t.repayment_penalty,
              payout_tiers: tierList,
            };
          }).filter(Boolean);

          return {
            ...s,
            season_base_payment: currentTerm?.base_payment ?? s.base_payment,
            season_bonus_amount: currentTerm?.bonus_amount ?? s.bonus_amount,
            season_bonus_condition: currentTerm?.bonus_condition_code ?? s.bonus_condition,
            bonus_merch_pct: currentTerm?.bonus_merch_pct,
            payout_type: currentTerm?.payout_type ?? "fixed",
            contract_window: contractLabel,
            contract_seasons: contractWindow,
            season_terms: seasonTerms,
            season,
          };
        });

        const orderMap = new Map(leagueSponsorRows.map((r, i) => [r.sponsor_id, i]));
        const sorted = enriched.sort((a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99));
        const canPickSponsor = [2, 5, 7, 9].includes(season);
        return NextResponse.json({ sponsors: sorted, season, canPickSponsor });
      }
    }

    const { data: sponsors, error } = await serviceSupabase
      .from("sponsors")
      .select("id, name, base_payment, bonus_amount, bonus_condition")
      .order("name");

    if (error) {
      console.error("Error fetching sponsors:", error);
      return NextResponse.json({ error: "Failed to fetch sponsors" }, { status: 500 });
    }

    return NextResponse.json({ sponsors: sponsors || [] });
  } catch (err: unknown) {
    console.error("Sponsors API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
