"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

interface Player {
  player_id: string;
  name: string;
  positions?: string;
  overall_rating: number;
  club_name?: string;
  image?: string;
  wage?: string;
  value?: string;
  isInjured?: boolean;
  injuryType?: string;
  gamesRemaining?: number;
}

interface Team {
  id: string;
  name: string;
  acronym: string;
  logo_url?: string;
  budget: number;
  squad: Player[];
  league_id: string;
}

interface League {
  id: string;
  name: string;
  season: number;
}

const TeamDashboardPage: React.FC = () => {
  const params = useParams();
  const teamId = params.teamId as string;
  
  const [team, setTeam] = useState<Team | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchTeamData = async () => {
    try {
      console.log('Team Management: Fetching team data for team:', teamId);
      
      // First, get the team's league ID from the team route
      console.log('Team Management: Calling team API to get league ID...');
      const teamResponse = await fetch(`/api/team/${teamId}`);
      console.log('Team Management: Team API response status:', teamResponse.status);
      
      if (!teamResponse.ok) {
        const errorData = await teamResponse.json();
        console.error('Team Management: Team API error:', errorData);
        setError(errorData.error || "Failed to fetch team data");
        return;
      }
      
      const teamData = await teamResponse.json();
      console.log('Team Management: Team API response data:', teamData);
      const leagueId = teamData.team?.league_id;
      console.log('Team Management: Extracted league ID:', leagueId);
      
      if (!leagueId) {
        console.error('Team Management: No league ID found in team data');
        console.error('Team Management: Full team data:', teamData);
        setError("Team has no associated league");
        return;
      }
      
      console.log('Team Management: Found league ID:', leagueId);
      console.log('Team Management: Now calling user team API with league ID');
      
      // Now call the working API route with the league ID
      console.log('Team Management: Calling user team API with league ID:', leagueId);
      const userTeamResponse = await fetch(`/api/user/team/${leagueId}`);
      console.log('Team Management: User team API response status:', userTeamResponse.status);
      
      if (userTeamResponse.ok) {
        const data = await userTeamResponse.json();
        console.log('Team Management: Full user team response data:', data);
        console.log('Team Management: Received team data:', data.team?.squad?.length || 0, 'players');
        console.log('Team Management: Sample player data:', data.team?.squad?.[0]);
        console.log('Team Management: Sample player image:', data.team?.squad?.[0]?.image);
        console.log('Team Management: All player images:', data.team?.squad?.map((p: { player_id: string; image?: string }) => ({ id: p.player_id, image: p.image })));
        
        // Transform the data to match the expected format
        const transformedTeam = {
          ...data.team,
          squad: data.team?.squad || []
        };
        
        console.log('Team Management: Transformed team data:', transformedTeam);
        console.log('Team Management: Transformed squad length:', transformedTeam.squad?.length);
        console.log('Team Management: Transformed first player image:', transformedTeam.squad?.[0]?.image);
        
        setTeam(transformedTeam);
        setLeague(data.league);
      } else {
        const errorData = await userTeamResponse.json();
        console.error('Team Management: User team API error:', errorData);
        setError(errorData.error || "Failed to fetch user team data");
      }
    } catch (error) {
      console.error("Error fetching team data:", error);
      setError("An error occurred while fetching team data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (teamId) {
      fetchTeamData();
    }
  }, [teamId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTeamData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPositionGroup = (positions: string | undefined | null) => {
    if (!positions) return "Other";
    if (positions.includes("GK")) return "Goalkeeper";
    if (positions.includes("LB") || positions.includes("CB") || positions.includes("RB")) return "Defender";
    if (positions.includes("LM") || positions.includes("RM") || positions.includes("CM") || positions.includes("CDM") || positions.includes("CAM")) return "Midfielder";
    if (positions.includes("LW") || positions.includes("RW") || positions.includes("ST") || positions.includes("CF")) return "Attacker";
    return "Other";
  };

  const groupPlayersByPosition = (players: Player[]) => {
    const grouped = {
      Goalkeeper: [] as Player[],
      Defender: [] as Player[],
      Midfielder: [] as Player[],
      Attacker: [] as Player[],
      Other: [] as Player[]
    };

    players.forEach(player => {
      if (player.isInjured) {
        // Injured players will be shown in a separate section
        return;
      }
      const group = getPositionGroup(player.positions);
      grouped[group as keyof typeof grouped].push(player);
    });

    return grouped;
  };

  const getInjuredPlayers = (players: Player[]) => {
    return players.filter(player => player.isInjured);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading team data...</p>
        </div>
      </div>
    );
  }

  // Debug: Log team data when component renders
  console.log('Team Management: Component render - team data:', team);
  console.log('Team Management: Component render - squad length:', team?.squad?.length);
  console.log('Team Management: Component render - first player:', team?.squad?.[0]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link
            href="/dashboard"
            className="text-indigo-600 hover:text-indigo-500"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">Team Not Found</div>
          <Link
            href="/dashboard"
            className="text-indigo-600 hover:text-indigo-500"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const groupedPlayers = groupPlayersByPosition(team.squad || []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              {team.logo_url && (
                <img
                  src={team.logo_url}
                  alt={`${team.name} logo`}
                  className="h-12 w-12 rounded-full mr-4"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
                <p className="text-gray-600">
                  {league?.name} - Season {league?.season}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
                <div>
                  <div className="text-sm text-gray-500">Budget</div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(team.budget)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* DEBUG: Temporary data display */}
        {team && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
            <strong>DEBUG INFO:</strong>
            <div>Squad Length: {team.squad?.length || 0}</div>
            <div>First Player: {JSON.stringify(team.squad?.[0])}</div>
            <div>First Player Image: {team.squad?.[0]?.image || 'No image'}</div>
          </div>
        )}
        {/* Squad Overview */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Squad Overview</h2>
            <p className="text-sm text-gray-600">
              {team.squad.length} players in your squad
              {team.squad.some(p => p.isInjured) && (
                <span className="ml-2 text-red-600">
                  ({team.squad.filter(p => p.isInjured).length} injured)
                </span>
              )}
            </p>
          </div>
          
                     <div className="p-6">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
               {Object.entries(groupedPlayers).map(([position, players]) => (
                 <div key={position} className="bg-gray-50 rounded-lg p-4">
                   <h3 className="font-medium text-gray-900 mb-2">{position}s</h3>
                   <div className="text-2xl font-bold text-indigo-600 mb-1">
                     {players.length}
                   </div>
                   <div className="text-sm text-gray-600">
                     {players.length > 0 && (
                       <div>
                         Avg Rating: {Math.round(players.reduce((sum, p) => sum + p.overall_rating, 0) / players.length)}
                       </div>
                     )}
                   </div>
                 </div>
               ))}
               {/* Unavailable Section */}
               {(() => {
                 const injuredPlayers = getInjuredPlayers(team.squad);
                 return (
                   <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                     <h3 className="font-medium text-red-900 mb-2">Unavailable</h3>
                     <div className="text-2xl font-bold text-red-600 mb-1">
                       {injuredPlayers.length}
                     </div>
                     <div className="text-sm text-red-600">
                       {injuredPlayers.length > 0 && (
                         <div>
                           Injured/Suspended
                         </div>
                       )}
                     </div>
                   </div>
                 );
               })()}
             </div>
           </div>
        </div>

                 {/* Available Squad Details */}
         <div className="bg-white rounded-lg shadow mb-8">
           <div className="px-6 py-4 border-b border-gray-200">
             <h2 className="text-lg font-medium text-gray-900">Available Squad</h2>
           </div>
           
           <div className="overflow-x-auto">
             <table className="min-w-full divide-y divide-gray-200">
               <thead className="bg-gray-50">
                 <tr>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Player
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Position
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Rating
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Club
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Value
                   </th>
                 </tr>
               </thead>
               <tbody className="bg-white divide-y divide-gray-200">
                 {team.squad.filter(player => !player.isInjured).map((player) => (
                   <tr key={player.player_id} className="hover:bg-gray-50">
                     <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {player.image ? (
                           <img
                             className="h-10 w-10 rounded-full mr-3"
                             src={player.image}
                             alt={player.name}
                             onError={(e) => console.error('Image failed to load:', player.image, e)}
                             onLoad={() => console.log('Image loaded successfully:', player.image)}
                           />
                         ) : (
                           <div className="h-10 w-10 rounded-full mr-3 bg-gray-300 flex items-center justify-center text-xs text-gray-600">
                             No Img
                           </div>
                         )}
                         <div>
                           <div className="text-sm font-medium text-gray-900">
                             {player.name}
                           </div>
                           <div className="text-xs text-gray-500">
                             Image: {player.image || 'No image'}
                           </div>
                         </div>
                       </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap">
                       <div className="text-sm text-gray-900">{player.positions}</div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap">
                       <div className="text-sm font-medium text-gray-900">
                         {player.overall_rating}
                       </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap">
                       <div className="text-sm text-gray-900">
                         {player.club_name || "Free Agent"}
                       </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap">
                       <div className="text-sm text-gray-900">
                         {player.value || "N/A"}
                       </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         </div>

         {/* Unavailable Squad Details */}
         {getInjuredPlayers(team.squad).length > 0 && (
           <div className="bg-white rounded-lg shadow mb-8">
             <div className="px-6 py-4 border-b border-red-200 bg-red-50">
               <h2 className="text-lg font-medium text-red-900">Unavailable Players</h2>
             </div>
             
             <div className="overflow-x-auto">
               <table className="min-w-full divide-y divide-gray-200">
                 <thead className="bg-red-50">
                   <tr>
                     <th className="px-6 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">
                       Player
                     </th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">
                       Position
                     </th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">
                       Rating
                     </th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">
                       Status
                     </th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">
                       Games Out
                     </th>
                   </tr>
                 </thead>
                 <tbody className="bg-white divide-y divide-gray-200">
                   {getInjuredPlayers(team.squad).map((player) => (
                     <tr key={player.player_id} className="bg-red-50">
                       <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {player.image ? (
                             <img
                               className="h-10 w-10 rounded-full mr-3 opacity-50"
                               src={player.image}
                               alt={player.name}
                               onError={(e) => console.error('Injured player image failed to load:', player.image, e)}
                               onLoad={() => console.log('Injured player image loaded successfully:', player.image)}
                             />
                           ) : (
                             <div className="h-10 w-10 rounded-full mr-3 bg-gray-300 opacity-50 flex items-center justify-center text-xs text-gray-600">
                               No Img
                             </div>
                           )}
                           <div>
                             <div className="text-sm font-medium text-gray-900">
                               {player.name}
                             </div>
                           </div>
                         </div>
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap">
                         <div className="text-sm text-gray-900">{player.positions}</div>
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap">
                         <div className="text-sm font-medium text-gray-900">
                           {player.overall_rating}
                         </div>
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap">
                         <div className="text-sm text-red-600 font-medium">
                           {player.injuryType || 'Injured'}
                         </div>
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap">
                         <div className="text-sm text-red-600 font-medium">
                           {player.gamesRemaining} games
                         </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
         )}

        {/* Navigation */}
        <div className="mt-8 flex justify-center">
          <Link
            href="/dashboard"
            className="text-indigo-600 hover:text-indigo-500 font-medium"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TeamDashboardPage; 