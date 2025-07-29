import { serve } from "https://deno.land/x/sift@0.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { handleCors, isPreflight } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req: Request) => {
  if (isPreflight(req)) {
    return handleCors(req);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return handleCors(req, new Response(JSON.stringify({ error: "Missing token" }), { status: 401 }));
    }

    const { name, teamName, teamAcronym, logoUrl, invites } = await req.json();

    const { data, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !data?.user) throw authErr || new Error("Invalid user");
    const user = data.user;

    // 👇 Insere liga
    const { data: league, error: leagueErr } = await supabase
      .from("leagues")
      .insert([{ name: name ?? "My League", season: 1, commissioner_user_id: user.id }])
      .select("id")
      .single();
    if (leagueErr) throw leagueErr;

    // 👇 Insere equipa
    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .insert([{ league_id: league.id, user_id: user.id, name: teamName, acronym: teamAcronym, logo_url: logoUrl, budget: 280_000_000 }])
      .select("id")
      .single();
    if (teamErr) throw teamErr;

    // 👇 Insere jogadores
    const positions = ["GK", "GK", "DEF", "DEF", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "MID", "MID", "ATT", "ATT", "ATT", "ATT"];
    const players = positions.map((pos, i) => ({
      player_id: crypto.randomUUID(),
      name: `Player ${i + 1}`,
      position: pos,
      rating: Math.floor(Math.random() * 11) + 50,
      age: Math.floor(Math.random() * 10) + 18,
      current_team_id: team.id,
    }));
    const { error: playersErr } = await supabase.from("player").insert(players);
    if (playersErr) throw playersErr;

    // 👇 Convida utilizadores
    if (Array.isArray(invites)) {
      for (const email of invites.filter((e: string) => e.trim() !== "")) {
        await supabase.from("league_invites").insert([{ league_id: league.id, email }]);
        await supabase.auth.admin.inviteUserByEmail(email.trim());
      }
    }

    return handleCors(req, new Response(JSON.stringify({ leagueId: league.id, teamId: team.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  } catch (err: any) {
    console.error("createLeague error:", err);
    return handleCors(req, new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }));
  }
});
