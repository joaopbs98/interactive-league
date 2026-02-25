// index.ts
import { serve } from "https://deno.land/x/sift@0.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { handleCors, isPreflight } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req: Request) => {
  // Handle preflight CORS request
  if (isPreflight(req)) {
    return handleCors(req);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return handleCors(
        req,
        new Response(JSON.stringify({ error: "Missing authorization header" }), {
          status: 401,
        })
      );
    }

    const { name, teamName, teamAcronym, logoUrl, invites } = await req.json();

    const { data, error: authErr } = await supabase.auth.getUser(token);
if (authErr || !data?.user) throw authErr || new Error("Invalid user");
const user = data.user;


    const leagueName = name && name.trim() !== "" ? name : "My League";
    const { data: league, error: leagueErr } = await supabase
      .from("leagues")
      .insert([
        {
          name: leagueName,
          season: 1,
          commissioner_user_id: user.id,
        },
      ])
      .select("id")
      .single();
    if (leagueErr) throw leagueErr;

    const initialBudget = 280_000_000;
    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .insert([
        {
          league_id: league.id,
          user_id: user.id,
          name: teamName,
          acronym: teamAcronym,
          logo_url: logoUrl,
          budget: initialBudget,
        },
      ])
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

    if (Array.isArray(invites)) {
      for (const email of invites.filter((e: string) => e && e.trim() !== "")) {
        await supabase.from("league_invites").insert([
          {
            league_id: league.id,
            email,
          },
        ]);
        await supabase.auth.admin.inviteUserByEmail(email.trim());
      }
    }

    const result = {
      leagueId: league.id,
      teamId: team.id,
    };

    return handleCors(
      req,
      new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  } catch (err: any) {
    console.error("createLeague error:", err);
    return handleCors(
      req,
      new Response(JSON.stringify({ error: err.message || err.toString() }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );
  }
});
