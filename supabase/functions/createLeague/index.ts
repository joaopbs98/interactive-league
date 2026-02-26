import { serve } from "https://deno.land/x/sift@0.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { handleCors, isPreflight } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (isPreflight(req)) {
    return handleCors(req);
  }

  let response: Response;
  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      response = new Response(JSON.stringify({ error: "Missing token" }), { status: 401 });
      return handleCors(req, response);
    }

    const { name, teamName, teamAcronym, logoUrl, invites } = await req.json();

    // Get user
    const { data, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !data?.user) {
      throw authErr || new Error("Invalid user");
    }
    const user = data.user;

    // Create League
    const { data: league, error: leagueErr } = await supabase
      .from("leagues")
      .insert([{ name: name ?? "My League", season: 1, commissioner_user_id: user.id }])
      .select("id")
      .single();
    if (leagueErr) throw leagueErr;

    // Create Team
    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .insert([{ league_id: league.id, user_id: user.id, name: teamName, acronym: teamAcronym, logo_url: logoUrl, budget: 280_000_000 }])
      .select("id")
      .single();
    if (teamErr) throw teamErr;

    // Select players for the squad based on ratings and positions
    const squad = [];
    
    // Define position requirements
    const positionRequirements = {
      GK: { min: 2, positions: ["GK"] },
      DEF: { min: 2, positions: ["LB", "CB", "RB"] },
      MID: { min: 2, positions: ["LM", "RM", "CM", "CDM", "CAM"] },
      ATT: { min: 2, positions: ["LW", "RW", "ST", "CF"] }
    };
    
    // Select players for each position type
    for (const [type, requirement] of Object.entries(positionRequirements)) {
      // Build OR conditions for each position in the requirement
      let query = supabase
        .from("player")
        .select("*")
        .gte("overall_rating", 50)
        .lte("overall_rating", 60);
      
      // Add position filters using OR logic
      const positionFilters = requirement.positions.map(pos => 
        `positions.ilike.%${pos}%`
      );
      
      // Apply position filters
      for (let i = 0; i < positionFilters.length; i++) {
        if (i === 0) {
          query = query.or(positionFilters[i]);
        } else {
          query = query.or(positionFilters[i]);
        }
      }
      
      const { data: players, error: playersErr } = await query.limit(requirement.min);
        
      if (playersErr) throw playersErr;
      
      if (players && players.length > 0) {
        squad.push(...players);
      }
    }
    
    // Fill remaining slots up to 18 players with any available players
    const remainingSlots = 18 - squad.length;
    if (remainingSlots > 0) {
      let additionalQuery = supabase
        .from("player")
        .select("*")
        .gte("overall_rating", 50)
        .lte("overall_rating", 60);
      
      // Exclude players already in squad
      if (squad.length > 0) {
        const squadIds = squad.map(p => p.player_id);
        additionalQuery = additionalQuery.not("player_id", "in", `(${squadIds.join(",")})`);
      }
      
      const { data: additionalPlayers, error: additionalErr } = await additionalQuery.limit(remainingSlots);
        
      if (additionalErr) throw additionalErr;
      
      if (additionalPlayers && additionalPlayers.length > 0) {
        squad.push(...additionalPlayers);
      }
    }
    
    // Update team with squad
    const { error: squadUpdateErr } = await supabase
      .from("teams")
      .update({ squad: squad })
      .eq("id", team.id);
      
    if (squadUpdateErr) throw squadUpdateErr;

    // Invite users
    if (Array.isArray(invites)) {
      for (const email of invites.filter((e: string) => e.trim() !== "")) {
        await supabase.from("league_invites").insert([{ league_id: league.id, email }]);
        await supabase.auth.admin.inviteUserByEmail(email.trim());
      }
    }

    response = new Response(JSON.stringify({ leagueId: league.id, teamId: team.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("createLeague error:", err?.message || err);
    response = new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  return handleCors(req, response);
});