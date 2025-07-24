// File: supabase/functions/createLeague/index.ts
import { serve } from "https://deno.land/[email protected]/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req: { headers: { get: (arg0: string) => string; }; json: () => { name: string; invites: string[]; } | PromiseLike<{ name: string; invites: string[]; }>; }) => {
  try {
    // 1. Autenticação
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) throw new Error("Unauthorized");
    const { name, invites }: { name: string; invites: string[] } =
      await req.json();

    // 2. Obter utilizador
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(jwt);
    if (authErr || !user) throw authErr || new Error("Invalid user");

    // 3. Criar liga
    const { data: league, error: leagueErr } = await supabase
      .from("leagues")
      .insert([{ name, season: 1, commissioner_user_id: user.id }])
      .select("id")
      .single();
    if (leagueErr) throw leagueErr;

    // 4. Criar equipa do host
    const initialBudget = 250_000_000;
    const teamName = `${user.user_metadata?.full_name || user.email}'s Team`;
    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .insert([
        {
          league_id: league.id,
          user_id: user.id,
          name: teamName,
          budget: initialBudget,
        },
      ])
      .select("id")
      .single();
    if (teamErr) throw teamErr;

    // 5. Gerar plantel inicial (14 jogadores, pode adaptar para 18)
    const positions = [
      "GK",
      "DEF",
      "DEF",
      "DEF",
      "DEF",
      "DEF",
      "MID",
      "MID",
      "MID",
      "MID",
      "ATT",
      "ATT",
      "ATT",
      "ATT",
    ];
    const squadInserts = positions.map((pos, idx) => ({
      player_id: crypto.randomUUID(),
      name: `Player ${idx + 1}`,
      position: pos,
      rating: Math.floor(Math.random() * 11) + 50,
      age: Math.floor(Math.random() * 10) + 18,
      current_team_id: team.id,
    }));
    const { error: playersErr } = await supabase
      .from("player")
      .insert(squadInserts);
    if (playersErr) throw playersErr;

    // 6. Criar convites para emails e enviar convite Supabase
    for (const email of (invites ?? []).filter(Boolean)) {
      await supabase
        .from("league_invites")
        .insert([{ league_id: league.id, email }]);
      await supabase.auth.admin.inviteUserByEmail(email);
    }

    return new Response(
      JSON.stringify({ leagueId: league.id, teamId: team.id }),
      { status: 200 }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
    });
  }
});
