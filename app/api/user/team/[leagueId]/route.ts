import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isLeagueHost } from "@/lib/hostUtils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    console.log("Fetching user team data API route called");
    const resolvedParams = await params;
    console.log("League ID from params:", resolvedParams.leagueId);
    
    const leagueId = resolvedParams.leagueId;
    
    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
      return NextResponse.json(
        { error: "Missing Supabase URL configuration" },
        { status: 500 }
      );
    }
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable");
      return NextResponse.json(
        { error: "Missing Supabase anon key configuration" },
        { status: 500 }
      );
    }
    
    // Create Supabase client
    const supabase = await createClient();

    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("Session error:", sessionError);
      return NextResponse.json(
        { error: "Session error: " + sessionError.message },
        { status: 401 }
      );
    }
    
    if (!session) {
      console.log("No session found");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.log("Fetching team for league ID:", leagueId);
    console.log("User ID:", session.user.id);

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // First, let's check if any teams exist for this user
    const { data: allUserTeams, error: allTeamsErr } = await supabase
      .from("teams")
      .select("id, name, league_id, user_id")
      .eq("user_id", session.user.id);
    
    console.log("All user teams:", allUserTeams);
    console.log("All user teams error:", allTeamsErr);
    
    // Check if any teams exist in this league
    const { data: leagueTeams, error: leagueTeamsErr } = await supabase
      .from("teams")
      .select("id, name, user_id")
      .eq("league_id", leagueId);
    
    console.log("All teams in league:", leagueTeams);
    console.log("League teams error:", leagueTeamsErr);
    
    // Fetch team data for the specific league with league info through join
    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .select(`
        id,
        name,
        acronym,
        logo_url,
        budget,
        squad,
        league_id,
        user_id,
        comp_index,
        stock_value,
        sponsor_id,
        formation,
        starting_lineup,
        bench,
        reserves,
        eafc_tactic_code,
        eafc_comment,
        leagues(
          id,
          name,
          season,
          commissioner_user_id
        )
      `)
      .eq("league_id", leagueId)
      .eq("user_id", session.user.id)
      .single();

    console.log("Team query result:", { team, error: teamErr });
    console.log("Team found successfully:", {
      teamId: team?.id,
      teamName: team?.name,
      squadLength: team?.squad?.length,
      startingLineupLength: team?.starting_lineup?.length,
      benchLength: team?.bench?.length,
      reservesLength: team?.reserves?.length
    });

    // If team found, fetch player details for the squad
    if (team && team.squad && team.squad.length > 0) {
      console.log("Fetching player details for squad...");
      
      // Extract player IDs from the squad (assuming squad contains player_id references)
      const squadPlayerIds = team.squad.map((player: any) => player.player_id).filter(Boolean);
      console.log("Squad player IDs:", squadPlayerIds);
      
      if (squadPlayerIds.length > 0) {
        // Fetch player details from player table
        const { data: squadPlayerDetails, error: squadPlayerDetailsError } = await supabase
          .from('player')
          .select(`
            player_id,
            name,
            full_name,
            image,
            description,
            positions,
            overall_rating,
            club_name,
            wage,
            value
          `)
          .in('player_id', squadPlayerIds);

        if (squadPlayerDetailsError) {
          console.error("Error fetching squad player details:", squadPlayerDetailsError);
        } else {
          console.log("Squad player details found:", squadPlayerDetails?.length || 0);
          
          // Create a map of player details by player_id
          const squadPlayerDetailsMap = new Map();
          squadPlayerDetails?.forEach(player => {
            squadPlayerDetailsMap.set(player.player_id, player);
          });
          
          // Merge player details into the squad
          team.squad = team.squad.map((squadPlayer: any) => {
            const playerDetail = squadPlayerDetailsMap.get(squadPlayer.player_id);
            if (playerDetail) {
              return {
                ...squadPlayer,
                name: playerDetail.full_name || playerDetail.name,
                image: playerDetail.image,
                description: playerDetail.description,
                positions: playerDetail.positions,
                overall_rating: playerDetail.overall_rating,
                club_name: playerDetail.club_name,
                wage: playerDetail.wage,
                value: playerDetail.value
              };
            }
            return squadPlayer;
          });
          
          console.log("Squad updated with player details. Sample player:", team.squad[0]);
        }
      }
    }

    if (teamErr) {
      console.error("Error fetching team:", teamErr);
      
      // Check if it's a "not found" error
      if (teamErr.code === 'PGRST116') {
        console.log("Team not found for user in this league");
        console.log("Debug info:", {
          leagueId,
          userId: session.user.id,
          allUserTeams: allUserTeams?.map(t => ({ id: t.id, name: t.name, league_id: t.league_id })),
          leagueTeams: leagueTeams?.map(t => ({ id: t.id, name: t.name, user_id: t.user_id }))
        });
        
        // Try to get league info through any team in the league (not just user's team)
        const { data: anyTeamInLeague, error: anyTeamErr } = await supabase
          .from("teams")
          .select(`
            leagues!inner(
              id,
              name,
              season,
              commissioner_user_id
            )
          `)
          .eq("league_id", leagueId)
          .limit(1)
          .single();
        
        if (anyTeamErr || !anyTeamInLeague) {
          return NextResponse.json(
            { 
              error: "League not found",
              debug: {
                leagueId,
                userId: session.user.id,
                allUserTeams: allUserTeams?.length || 0,
                leagueTeams: leagueTeams?.length || 0,
                leagueExists: false
              }
            },
            { status: 404 }
          );
        }
        
        // Create a mock team with real league info
        console.log("Creating mock team with real league info...");
        const mockTeam = {
          id: "mock-team-id",
          name: "Mock Team",
          acronym: "MT",
          logo_url: null,
          budget: 250000000,
          squad: [],
          league_id: leagueId,
          comp_index: 0,
          stock_value: 250000000,
          sponsor_id: null
        };
        
        console.log("Returning mock team data with real league");
        return NextResponse.json({
          success: true,
          team: mockTeam,
          league: anyTeamInLeague.leagues,
          dashboardData: {
            leagueRank: "No data",
            domesticCup: "No data",
            internationalCompetition: "No data",
            upcomingEvents: [],
            reminders: [],
            mvpOfTheWeek: null,
            sponsorExpiring: false
          },
          debug: {
            message: "Using mock team data - user has no team in this league",
            leagueId,
            userId: session.user.id
          }
        });
      }
      
      // Try with service role client as fallback for other errors
      console.log("Trying with service role client as fallback...");
      
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
        return NextResponse.json(
          { error: "Missing service role key configuration" },
          { status: 500 }
        );
      }
      
      const serviceSupabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const { data: serviceTeam, error: serviceTeamErr } = await serviceSupabase
        .from("teams")
        .select(`
          id,
          name,
          acronym,
          logo_url,
          budget,
          squad,
          league_id,
          user_id,
          comp_index,
          stock_value,
          sponsor_id,
          formation,
          starting_lineup,
          bench,
          reserves,
          eafc_tactic_code,
          eafc_comment,
          leagues(
            id,
            name,
            season,
            commissioner_user_id
          )
        `)
        .eq("league_id", leagueId)
        .eq("user_id", session.user.id)
        .single();

      // If service team found, fetch player details for the squad
      if (serviceTeam && serviceTeam.squad && serviceTeam.squad.length > 0) {
        console.log("Service role - Fetching player details for squad...");
        
        // Extract player IDs from the squad
        const serviceSquadPlayerIds = serviceTeam.squad.map((player: any) => player.player_id).filter(Boolean);
        console.log("Service role - Squad player IDs:", serviceSquadPlayerIds);
        
        if (serviceSquadPlayerIds.length > 0) {
          // Fetch player details from player table
          const { data: serviceSquadPlayerDetails, error: serviceSquadPlayerDetailsError } = await serviceSupabase
            .from('player')
            .select(`
              player_id,
              name,
              full_name,
              image,
              description,
              positions,
              overall_rating,
              club_name,
              wage,
              value
            `)
            .in('player_id', serviceSquadPlayerIds);

          if (serviceSquadPlayerDetailsError) {
            console.error("Service role - Error fetching squad player details:", serviceSquadPlayerDetailsError);
          } else {
            console.log("Service role - Squad player details found:", serviceSquadPlayerDetails?.length || 0);
            
            // Create a map of player details by player_id
            const serviceSquadPlayerDetailsMap = new Map();
            serviceSquadPlayerDetails?.forEach(player => {
              serviceSquadPlayerDetailsMap.set(player.player_id, player);
            });
            
            // Merge player details into the squad
            serviceTeam.squad = serviceTeam.squad.map((squadPlayer: any) => {
              const playerDetail = serviceSquadPlayerDetailsMap.get(squadPlayer.player_id);
              if (playerDetail) {
                return {
                  ...squadPlayer,
                  name: playerDetail.full_name || playerDetail.name,
                  image: playerDetail.image,
                  description: playerDetail.description,
                  positions: playerDetail.positions,
                  overall_rating: playerDetail.overall_rating,
                  club_name: playerDetail.club_name,
                  wage: playerDetail.wage,
                  value: playerDetail.value
                };
              }
              return squadPlayer;
            });
            
            console.log("Service role - Squad updated with player details. Sample player:", serviceTeam.squad[0]);
          }
        }
      }
      
      console.log("Service role team query result:", { serviceTeam, error: serviceTeamErr });
      
      if (serviceTeamErr || !serviceTeam) {
        console.error("Service role client also failed:", serviceTeamErr);
        
        // Try to get league info with service role
        const { data: serviceLeagueInfo, error: serviceLeagueErr } = await serviceSupabase
          .from("teams")
          .select(`
            leagues!inner(
              id,
              name,
              season,
              commissioner_user_id
            )
          `)
          .eq("league_id", leagueId)
          .limit(1)
          .single();
        
        if (serviceLeagueErr || !serviceLeagueInfo) {
          // Create a mock team for development purposes
          console.log("Creating mock team for development...");
          const mockTeam = {
            id: "mock-team-id",
            name: "Mock Team",
            acronym: "MT",
            logo_url: null,
            budget: 250000000,
            squad: [],
            league_id: leagueId,
            comp_index: 0,
            stock_value: 250000000,
            sponsor_id: null
          };
          
          const mockLeague = { id: leagueId, name: "Mock League", season: 1 };
          
          console.log("Returning mock team data");
          return NextResponse.json({
            success: true,
            team: mockTeam,
            league: mockLeague,
            dashboardData: {
              leagueRank: "No data",
              domesticCup: "No data",
              internationalCompetition: "No data",
              upcomingEvents: [],
              reminders: [],
              mvpOfTheWeek: null,
              sponsorExpiring: false
            },
            debug: {
              message: "Using mock team data - league not found",
              leagueId,
              userId: session.user.id
            }
          });
        }
        
        // Create a mock team with real league info
        console.log("Creating mock team with real league info...");
        const mockTeam = {
          id: "mock-team-id",
          name: "Mock Team",
          acronym: "MT",
          logo_url: null,
          budget: 250000000,
          squad: [],
          league_id: leagueId,
          comp_index: 0,
          stock_value: 250000000,
          sponsor_id: null
        };
        
        console.log("Returning mock team data with real league");
        return NextResponse.json({
          success: true,
          team: mockTeam,
          league: serviceLeagueInfo.leagues,
          dashboardData: {
            leagueRank: "No data",
            domesticCup: "No data",
            internationalCompetition: "No data",
            upcomingEvents: [],
            reminders: [],
            mvpOfTheWeek: null,
            sponsorExpiring: false
          },
          debug: {
            message: "Using mock team data - user has no team in this league",
            leagueId,
            userId: session.user.id
          }
        });
      }
      
      // Use service team data
      const league = serviceTeam.leagues;
      
      // Fetch players from league_players table with full player details
      console.log("Fetching players from league_players table for team:", serviceTeam.id);
      
      let { data: leaguePlayers, error: leaguePlayersError } = await serviceSupabase
        .from('league_players')
        .select(`
          id,
          player_id,
          player_name,
          full_name,
          description,
          positions,
          rating,
          team_id,
          origin_type,
          is_youngster,
          potential,
          created_at
        `)
        .eq('team_id', serviceTeam.id);

      if (leaguePlayersError) {
        console.error("Error fetching league players:", leaguePlayersError);
        return NextResponse.json(
          { error: "Failed to fetch team players" },
          { status: 500 }
        );
      }

      console.log("League players found:", leaguePlayers?.length || 0);

      if (leaguePlayersError) {
        console.error("Error fetching league players:", leaguePlayersError);
        return NextResponse.json(
          { error: "Failed to fetch team players" },
          { status: 500 }
        );
      }

      // Extract player IDs to fetch player details
      const playerIds = leaguePlayers?.map(p => p.player_id) || [];
      console.log("Player IDs to fetch:", playerIds);

      // Fetch player details from player table
      let { data: playerDetails, error: playerDetailsError } = await serviceSupabase
        .from('player')
        .select(`
          player_id,
          name,
          full_name,
          image,
          description,
          positions,
          overall_rating,
          club_name,
          wage,
          value,
          potential,
          country_name
        `)
        .in('player_id', playerIds);

      // Fetch contract wages for squad players
      const { data: contracts } = await serviceSupabase
        .from('contracts')
        .select('player_id, wage')
        .eq('team_id', serviceTeam.id)
        .eq('status', 'active')
        .in('player_id', playerIds);
      const contractWageMap = new Map((contracts || []).map((c: { player_id: string; wage: number }) => [c.player_id, c.wage]));

      if (playerDetailsError) {
        console.error("Error fetching player details:", playerDetailsError);
        // Continue without player details, will use fallback images
      }

      console.log("Player details found:", playerDetails?.length || 0);

      // Create a map of player details by player_id for efficient lookup
      const playerDetailsMap = new Map();
      playerDetails?.forEach(player => {
        playerDetailsMap.set(player.player_id, player);
      });

      console.log("Player details map created with", playerDetailsMap.size, "entries");
      
      // Get active injuries for this team to filter out injured players
      const { data: serviceInjuries, error: serviceInjuriesError } = await serviceSupabase
        .from('injuries')
        .select('player_id, type, games_remaining')
        .eq('team_id', serviceTeam.id)
        .gt('games_remaining', 0);

      if (serviceInjuriesError) {
        console.error("Error fetching injuries with service role:", serviceInjuriesError);
      }

      // Create a map of injury details by player ID
      const serviceInjuryMap = new Map();
      serviceInjuries?.forEach(injury => {
        serviceInjuryMap.set(injury.player_id, {
          type: injury.type,
          games_remaining: injury.games_remaining
        });
      });
      
      console.log("Service role - Injury map:", Object.fromEntries(serviceInjuryMap));

      // Convert league_players to the expected format and filter out injured players
      const allPlayers = (leaguePlayers || []).map((player: any) => {
        const injury = serviceInjuryMap.get(player.player_id);
        const playerDetail = playerDetailsMap.get(player.player_id);
        const contractWage = contractWageMap.get(player.player_id);
        
        return {
          ...player,
          name: playerDetail?.full_name || player.full_name || player.player_name, // Use full_name if available
          image: playerDetail?.image, // Use image from player table
          description: playerDetail?.description || player.description,
          positions: playerDetail?.positions || player.positions,
          overall_rating: playerDetail?.overall_rating || player.rating,
          club_name: playerDetail?.club_name,
          wage: contractWage ?? playerDetail?.wage,
          value: playerDetail?.value,
          potential: player.potential ?? playerDetail?.potential,
          country_name: playerDetail?.country_name,
          origin_type: player.origin_type,
          is_youngster: player.is_youngster ?? false,
          isInjured: !!injury,
          injuryType: injury?.type,
          gamesRemaining: injury?.games_remaining
        };
      });

      const serviceAvailableSquad = allPlayers.filter((player: any) => !serviceInjuryMap.has(player.player_id));
      console.log(`Service role - Filtered squad: ${serviceAvailableSquad.length} available players out of ${allPlayers.length} total`);
      
      // Debug: Log sample player data to check images
      if (serviceAvailableSquad.length > 0) {
        console.log("Sample player data (first 3):", serviceAvailableSquad.slice(0, 3).map(p => ({
          id: p.player_id,
          name: p.name,
          image: p.image,
          hasImage: !!p.image
        })));
      }
      
      // Get the full squad and distribution logic for service team (now filtered)
      const fullSquad = serviceAvailableSquad;
      const startingLineup = serviceTeam.starting_lineup || [];
      const savedBench = serviceTeam.bench || [];
      const savedReserves = serviceTeam.reserves || [];
      
      let startingPlayers, benchPlayers, reservePlayers;

      // Apply same distribution logic as main team
      if (savedBench.length > 0 || savedReserves.length > 0) {
        // First, get all available players (including those who were previously injured but are now available)
        const allAvailablePlayers = allPlayers.filter((player: any) => !serviceInjuryMap.has(player.player_id));
        
        // Map saved data to available players
        startingPlayers = startingLineup.map((id: string) => allAvailablePlayers.find((p: any) => p.player_id === id)).filter(Boolean);
        benchPlayers = savedBench.map((id: string) => allAvailablePlayers.find((p: any) => p.player_id === id)).filter(Boolean);
        reservePlayers = savedReserves.map((id: string) => allAvailablePlayers.find((p: any) => p.player_id === id)).filter(Boolean);
        
        // Add any remaining available players to reserves
        const usedPlayerIds = new Set([
          ...startingPlayers.map((p: any) => p.player_id),
          ...benchPlayers.map((p: any) => p.player_id),
          ...reservePlayers.map((p: any) => p.player_id)
        ]);
        
        const remainingPlayers = allAvailablePlayers.filter((p: any) => !usedPlayerIds.has(p.player_id));
        reservePlayers = [...reservePlayers, ...remainingPlayers];
        
      } else if (startingLineup.length > 0) {
        startingPlayers = startingLineup.map((id: string) => fullSquad.find((p: any) => p.player_id === id)).filter(Boolean);
        const remainingPlayers = fullSquad.filter((p: any) => !startingLineup.includes(p.player_id));
        benchPlayers = remainingPlayers.slice(0, 7);
        reservePlayers = remainingPlayers.slice(7);
      } else {
        startingPlayers = fullSquad.slice(0, 11);
        benchPlayers = fullSquad.slice(11, 18);
        reservePlayers = fullSquad.slice(18);
      }
      
      // Auto-replace injured players in starting lineup (service role version)
      const replaceInjuredPlayersService = (lineup: any[], availablePlayers: any[]) => {
        const replacedLineup = [...lineup];
        const usedPlayers = new Set(lineup.map(p => p.player_id));
        
        lineup.forEach((player, index) => {
          if (serviceInjuryMap.has(player.player_id)) {
            console.log(`Service role - Replacing injured player: ${player.name} (${player.positions})`);
            
            // Find best replacement based on position
            const bestReplacement = findBestReplacementService(player.positions, availablePlayers, usedPlayers);
            
            if (bestReplacement) {
              replacedLineup[index] = bestReplacement;
              usedPlayers.add(bestReplacement.player_id);
              console.log(`Service role - Replaced with: ${bestReplacement.name} (${bestReplacement.positions})`);
            } else {
              console.log(`Service role - No suitable replacement found for ${player.name}`);
            }
          }
        });
        
        return replacedLineup;
      };
      
      const findBestReplacementService = (originalPositions: string, availablePlayers: any[], usedPlayers: Set<string>) => {
        // First, try to find a player with exact position match
        const exactMatch = availablePlayers.find(p => 
          !usedPlayers.has(p.player_id) && 
          p.positions.split(',').some((pos: string) => originalPositions.includes(pos.trim()))
        );
        
        if (exactMatch) return exactMatch;
        
        // If no exact match, find by position group
        const positionGroups = {
          'GK': ['GK'],
          'CB,LB,RB': ['CB', 'LB', 'RB', 'LWB', 'RWB'],
          'CM,CDM,CAM,LM,RM': ['CM', 'CDM', 'CAM', 'LM', 'RM'],
          'ST,CF,LW,RW': ['ST', 'CF', 'LW', 'RW', 'AM']
        };
        
        for (const [group, positions] of Object.entries(positionGroups)) {
          if (originalPositions.split(',').some((pos: string) => positions.includes(pos.trim()))) {
            const groupMatch = availablePlayers.find(p => 
              !usedPlayers.has(p.player_id) && 
              p.positions.split(',').some((pos: string) => positions.includes(pos.trim()))
            );
            if (groupMatch) return groupMatch;
          }
        }
        
        // Last resort: any available player
        return availablePlayers.find(p => !usedPlayers.has(p.player_id));
      };
      
      // Apply auto-replacement to starting lineup
      const originalStartingService = [...startingPlayers];
      startingPlayers = replaceInjuredPlayersService(startingPlayers, serviceAvailableSquad);
      
      // Check if any replacements were made
      const replacementsMadeService = startingPlayers.some((player, index) => 
        player.player_id !== originalStartingService[index]?.player_id
      );
      
      if (replacementsMadeService) {
        console.log("Service role - Auto-replacements made due to injuries");
        // Update the database with the new lineup
        const newStartingIds = startingPlayers.map(p => p.player_id);
        const { error: updateError } = await serviceSupabase
          .from('teams')
          .update({ starting_lineup: newStartingIds })
          .eq('id', serviceTeam.id);
        
        if (updateError) {
          console.error("Service role - Error updating lineup after injury replacements:", updateError);
        } else {
          console.log("Service role - Lineup updated in database after injury replacements");
        }
      }
      
      const cleanTeam = {
        id: serviceTeam.id,
        name: serviceTeam.name,
        acronym: serviceTeam.acronym,
        logo_url: serviceTeam.logo_url,
        budget: serviceTeam.budget,
        user_id: serviceTeam.user_id,
        squad: fullSquad,
        allPlayers: allPlayers, // Include all players for display purposes
        league_id: serviceTeam.league_id,
        comp_index: serviceTeam.comp_index,
        stock_value: serviceTeam.stock_value,
        sponsor_id: serviceTeam.sponsor_id,
        formation: serviceTeam.formation || "3-1-4-2",
        starting_lineup: startingPlayers,
        bench: benchPlayers,
        reserves: reservePlayers,
        eafc_tactic_code: serviceTeam.eafc_tactic_code ?? null,
        eafc_comment: serviceTeam.eafc_comment ?? null
      };
      
      // Fetch dashboard data for service team
      const dashboardData = await fetchDashboardData(serviceSupabase, leagueId, serviceTeam.id);
      
      console.log("Successfully fetched user team data with service role");
      return NextResponse.json({
        success: true,
        team: cleanTeam,
        league: league,
        dashboardData: dashboardData
      });
    }

    // Extract league data
    const league = team.leagues;

    // Fetch players from league_players table with full player details
    console.log("Fetching players from league_players table for team:", team.id);
    
          let { data: leaguePlayers, error: leaguePlayersError } = await supabase
        .from('league_players')
        .select(`
          id,
          player_id,
          player_name,
          full_name,
          description,
          positions,
          rating,
          team_id,
          origin_type,
          is_youngster,
          potential,
          created_at
        `)
        .eq('team_id', team.id);

      if (leaguePlayersError) {
        console.error("Error fetching league players:", leaguePlayersError);
        return NextResponse.json(
          { error: "Failed to fetch team players" },
          { status: 500 }
        );
      }

      console.log("League players found:", leaguePlayers?.length || 0);

    const playerIds = leaguePlayers?.map((p: { player_id: string }) => p.player_id) || [];
    const { data: playerDetails, error: playerDetailsError } = await supabase
      .from('player')
      .select('player_id, name, full_name, image, description, positions, overall_rating, club_name, wage, value, potential, country_name')
      .in('player_id', playerIds);
    const playerDetailsMap = new Map();
    playerDetails?.forEach((p: { player_id: string }) => playerDetailsMap.set(p.player_id, p));

    const { data: contracts } = await supabase
      .from('contracts')
      .select('player_id, wage')
      .eq('team_id', team.id)
      .eq('status', 'active')
      .in('player_id', playerIds);
    const contractWageMap = new Map((contracts || []).map((c: { player_id: string; wage: number }) => [c.player_id, c.wage]));

    if (playerDetailsError) {
      console.error("Error fetching player details:", playerDetailsError);
    }

    // Get active injuries for this team to filter out injured players
    const { data: injuries, error: injuriesError } = await supabase
      .from('injuries')
      .select('player_id, type, games_remaining')
      .eq('team_id', team.id)
      .gt('games_remaining', 0);

    if (injuriesError) {
      console.error("Error fetching injuries:", injuriesError);
    }

    // Create a map of injury details by player ID
    const injuryMap = new Map();
    injuries?.forEach(injury => {
      injuryMap.set(injury.player_id, {
        type: injury.type,
        games_remaining: injury.games_remaining
      });
    });
    
    console.log("Injury map:", Object.fromEntries(injuryMap));

    // Convert league_players to the expected format and filter out injured players
    const allPlayers = (leaguePlayers || []).map((player: any) => {
      const injury = injuryMap.get(player.player_id);
      const playerDetail = playerDetailsMap.get(player.player_id);
      const contractWage = contractWageMap.get(player.player_id);
      return {
        ...player,
        name: playerDetail?.full_name || player.full_name || player.player_name,
        image: playerDetail?.image,
        description: playerDetail?.description || player.description,
        positions: playerDetail?.positions || player.positions,
        overall_rating: playerDetail?.overall_rating ?? player.rating,
        club_name: playerDetail?.club_name,
        wage: contractWage ?? playerDetail?.wage,
        value: playerDetail?.value,
        potential: player.potential ?? playerDetail?.potential,
        country_name: playerDetail?.country_name,
        origin_type: player.origin_type,
        is_youngster: player.is_youngster ?? false,
        isInjured: !!injury,
        injuryType: injury?.type,
        gamesRemaining: injury?.games_remaining
      };
    });

    // For tactics/formation management, filter out injured players completely
    const availableSquad = allPlayers.filter((player: any) => !injuryMap.has(player.player_id));
    console.log(`Filtered squad: ${availableSquad.length} available players out of ${allPlayers.length} total`);

    // Clean up team data (remove the nested leagues object)
    // Get the full squad (now filtered for tactics)
    const fullSquad = availableSquad;
    console.log("API - Full squad length:", fullSquad.length);
    
    // Get saved data from database
    const startingLineup = team.starting_lineup || [];
    const savedBench = team.bench || [];
    const savedReserves = team.reserves || [];
    console.log("API - Data from DB:", { startingLineup, savedBench, savedReserves });
    
    let startingPlayers, benchPlayers, reservePlayers;

    // Check if we have saved bench/reserves data or just starting lineup
    if (savedBench.length > 0 || savedReserves.length > 0) {
      console.log("API - Using saved bench/reserves data");
      
      // First, get all available players (including those who were previously injured but are now available)
      const allAvailablePlayers = allPlayers.filter((player: any) => !injuryMap.has(player.player_id));
        
        // Map saved data to available players
        startingPlayers = startingLineup.map((id: string) => allAvailablePlayers.find((p: any) => p.player_id === id)).filter(Boolean);
        benchPlayers = savedBench.map((id: string) => allAvailablePlayers.find((p: any) => p.player_id === id)).filter(Boolean);
        reservePlayers = savedReserves.map((id: string) => allAvailablePlayers.find((p: any) => p.player_id === id)).filter(Boolean);
        
        // Add any remaining available players to reserves
        const usedPlayerIds = new Set([
          ...startingPlayers.map((p: any) => p.player_id),
          ...benchPlayers.map((p: any) => p.player_id),
          ...reservePlayers.map((p: any) => p.player_id)
        ]);
        
        const remainingPlayers = allAvailablePlayers.filter((p: any) => !usedPlayerIds.has(p.player_id));
        reservePlayers = [...reservePlayers, ...remainingPlayers];
        
      } else if (startingLineup.length > 0) {
        console.log("API - Using saved lineup structure");
        // Use saved lineup structure but distribute remaining players
        startingPlayers = startingLineup.map((id: string) => fullSquad.find((p: any) => p.player_id === id)).filter(Boolean);
        // Rest go to bench and reserves
        const remainingPlayers = fullSquad.filter((p: any) => !startingLineup.includes(p.player_id));
        benchPlayers = remainingPlayers.slice(0, 7); // Next 7 as bench
        reservePlayers = remainingPlayers.slice(7); // Rest as reserves
      } else {
        console.log("API - Using default distribution");
        // Default: first 11 as starting, next 7 as bench, rest as reserves
        startingPlayers = fullSquad.slice(0, 11);
        benchPlayers = fullSquad.slice(11, 18);
        reservePlayers = fullSquad.slice(18);
      }

      // Auto-replace injured players in starting lineup
      const replaceInjuredPlayers = (lineup: any[], availablePlayers: any[]) => {
        const replacedLineup = [...lineup];
        const usedPlayers = new Set(lineup.map(p => p.player_id));
        
        lineup.forEach((player, index) => {
          if (injuryMap.has(player.player_id)) {
            console.log(`Replacing injured player: ${player.name} (${player.positions})`);
            
            // Find best replacement based on position
            const bestReplacement = findBestReplacement(player.positions, availablePlayers, usedPlayers);
            
            if (bestReplacement) {
              replacedLineup[index] = bestReplacement;
              usedPlayers.add(bestReplacement.player_id);
              console.log(`Replaced with: ${bestReplacement.name} (${bestReplacement.positions})`);
            } else {
              console.log(`No suitable replacement found for ${player.name}`);
            }
          }
        });
        
        return replacedLineup;
      };
      
      const findBestReplacement = (originalPositions: string, availablePlayers: any[], usedPlayers: Set<string>) => {
        // First, try to find a player with exact position match
                 const exactMatch = availablePlayers.find(p => 
           !usedPlayers.has(p.player_id) && 
           p.positions.split(',').some((pos: string) => originalPositions.includes(pos.trim()))
         );
        
        if (exactMatch) return exactMatch;
        
        // If no exact match, find by position group
        const positionGroups = {
          'GK': ['GK'],
          'CB,LB,RB': ['CB', 'LB', 'RB', 'LWB', 'RWB'],
          'CM,CDM,CAM,LM,RM': ['CM', 'CDM', 'CAM', 'LM', 'RM'],
          'ST,CF,LW,RW': ['ST', 'CF', 'LW', 'RW', 'AM']
        };
        
                 for (const [group, positions] of Object.entries(positionGroups)) {
           if (originalPositions.split(',').some((pos: string) => positions.includes(pos.trim()))) {
             const groupMatch = availablePlayers.find(p => 
               !usedPlayers.has(p.player_id) && 
               p.positions.split(',').some((pos: string) => positions.includes(pos.trim()))
             );
             if (groupMatch) return groupMatch;
           }
         }
        
        // Last resort: any available player
        return availablePlayers.find(p => !usedPlayers.has(p.player_id));
      };
      
      // Apply auto-replacement to starting lineup
      const originalStarting = [...startingPlayers];
      startingPlayers = replaceInjuredPlayers(startingPlayers, availableSquad);
      
      // Check if any replacements were made
      const replacementsMade = startingPlayers.some((player, index) => 
        player.player_id !== originalStarting[index]?.player_id
      );
      
      if (replacementsMade) {
        console.log("Auto-replacements made due to injuries");
        // Update the database with the new lineup
        const newStartingIds = startingPlayers.map(p => p.player_id);
        const { error: updateError } = await supabase
          .from('teams')
          .update({ starting_lineup: newStartingIds })
          .eq('id', team.id);
        
        if (updateError) {
          console.error("Error updating lineup after injury replacements:", updateError);
        } else {
          console.log("Lineup updated in database after injury replacements");
        }
      }

      console.log("API - Final distribution:", {
        starting: startingPlayers.length,
        bench: benchPlayers.length,
        reserves: reservePlayers.length
      });

      const cleanTeam = {
        id: team.id,
        name: team.name,
        acronym: team.acronym,
        logo_url: team.logo_url,
        budget: team.budget,
        user_id: team.user_id,
        squad: fullSquad,
        allPlayers: allPlayers, // Include all players for display purposes
        league_id: team.league_id,
        comp_index: team.comp_index,
        stock_value: team.stock_value,
        sponsor_id: team.sponsor_id,
        formation: team.formation || "3-1-4-2",
        starting_lineup: startingPlayers,
        bench: benchPlayers,
        reserves: reservePlayers,
        eafc_tactic_code: team.eafc_tactic_code ?? null,
        eafc_comment: team.eafc_comment ?? null
      };

    // Fetch additional dashboard data
    const dashboardData = await fetchDashboardData(supabase, leagueId, team.id);

    const isHost = await isLeagueHost(serviceSupabase, leagueId, session.user.id);
    const leagueWithHost = { ...league, is_host: isHost };

    console.log("Successfully fetched user team data");
    console.log("Final response data:", {
      teamId: cleanTeam.id,
      teamName: cleanTeam.name,
      squadLength: cleanTeam.squad?.length,
      startingLineupLength: cleanTeam.starting_lineup?.length,
      benchLength: cleanTeam.bench?.length,
      reservesLength: cleanTeam.reserves?.length,
      samplePlayer: cleanTeam.squad?.[0]
    });
    return NextResponse.json({
      success: true,
      team: { ...cleanTeam, leagues: leagueWithHost },
      league: leagueWithHost,
      dashboardData: dashboardData
    });

  } catch (error: any) {
    console.error("Fetch user team data API route error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to fetch dashboard-specific data
async function fetchDashboardData(supabase: any, leagueId: string, teamId: string) {
  try {
    // Get league standings to determine team rank
    const { data: standings, error: standingsErr } = await supabase
      .from("teams")
      .select("id, name, comp_index")
      .eq("league_id", leagueId)
      .order("comp_index", { ascending: false });

    let leagueRank = "No data";
    if (standings && !standingsErr) {
      const teamIndex = standings.findIndex((team: any) => team.id === teamId);
      if (teamIndex !== -1) {
        const position = teamIndex + 1;
        const suffix = position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th";
        leagueRank = `${position}${suffix} Place`;
      }
    }

    // Check if sponsor is expiring (mock logic for now)
    const sponsorExpiring = false; // TODO: Implement real sponsor expiration check

    // Get upcoming events (mock data for now)
    const upcomingEvents = [
      { title: "Market Closes", description: "6 Days", type: "warning" },
      { title: "Squad Submission", description: "7 Days", type: "info" }
    ];

    // Get user reminders (mock data for now)
    const reminders = [
      { title: "Do not forget to renew contracts!", type: "default" },
      { title: "We need to reach CL otherwise we are cooked...", type: "default" }
    ];

    // Get MVP of the week (mock data for now)
    const mvpOfTheWeek = {
      name: "No data",
      rating: 0,
      goals: 0,
      assists: 0,
      average: 0,
      image: null
    };

    return {
      leagueRank,
      domesticCup: "No data",
      internationalCompetition: "No data",
      upcomingEvents,
      reminders,
      mvpOfTheWeek,
      sponsorExpiring
    };

  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return {
      leagueRank: "No data",
      domesticCup: "No data",
      internationalCompetition: "No data",
      upcomingEvents: [],
      reminders: [],
      mvpOfTheWeek: null,
      sponsorExpiring: false
    };
  }
} 