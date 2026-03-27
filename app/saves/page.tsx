"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLeague } from "@/contexts/LeagueContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Trophy } from "lucide-react";

interface League {
  id: string;
  name: string;
  season: number;
  status?: string;
  team_count: number;
  commissioner_user_id: string;
  created_at: string;
  updated_at?: string;
  my_team?: {
    id: string;
    name: string;
    acronym: string;
    logo_url?: string;
  };
}

const SavesPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSelectedLeague } = useLeague();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const fetchUserLeagues = async () => {
    try {
      setLoading(true);
      setError("");
      setDebugInfo(null);
      console.log("Fetching user leagues...");
      
      // First, let's check if we can get the user session
      const sessionResponse = await fetch("/api/auth/session");
      console.log("Session response status:", sessionResponse.status);
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        console.log("Session data:", sessionData);
      } else {
        console.error("Session check failed:", sessionResponse.status);
      }
      
      // Test environment variables
      const envResponse = await fetch("/api/test-env");
      if (envResponse.ok) {
        const envData = await envResponse.json();
        console.log("Environment check:", envData);
        setDebugInfo((prev: any) => ({ ...prev, environment: envData.environment }));
      }
      
      const response = await fetch("/api/user/leagues");
      console.log("Leagues API response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("Leagues data received:", data);
        console.log("Number of leagues:", data.leagues?.length || 0);
        setLeagues(data.leagues || []);
        setDebugInfo((prev: any) => ({ ...prev, leaguesData: data }));
      } else {
        const errorData = await response.json();
        console.error("Error response:", errorData);
        setError(errorData.error || "Failed to fetch leagues");
        setDebugInfo((prev: any) => ({ ...prev, errorData }));
      }
    } catch (error: any) {
      console.error("Error fetching user leagues:", error);
              setError("An error occurred while fetching leagues");
        setDebugInfo((prev: any) => ({ ...prev, exception: error.toString() }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserLeagues();
  }, []);

  // Check if we're returning from league creation
  useEffect(() => {
    const created = searchParams.get("created");
    if (created === "true") {
      console.log("League was created, refreshing data...");
      fetchUserLeagues();
      // Remove the query parameter
      router.replace("/saves");
    }
  }, [searchParams, router]);

  const handleSelectLeague = (leagueId: string) => {
    console.log("Selecting league:", leagueId);
    setSelectedLeague(leagueId);
    router.push(`/main/dashboard?league=${leagueId}`);
  };

  const handleCreateLeague = () => {
    if (leagues.length >= 2) {
      alert("You can only be in a maximum of 2 leagues at a time.");
      return;
    }
    router.push("/createleague");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading your leagues...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-400 text-xl mb-4">Error</div>
          <p className="text-gray-300 mb-4">{error}</p>
          
          {/* Debug Information */}
          {debugInfo && (
            <div className="text-left text-xs text-gray-400 mb-4 p-2 bg-gray-800 rounded">
              <p className="font-semibold">Debug Info:</p>
              <pre className="whitespace-pre-wrap">{JSON.stringify(debugInfo, null, 2)}</pre>
            </div>
          )}
          
          <div className="space-y-2">
            <Button onClick={() => fetchUserLeagues()} className="w-full">
              Try Again
            </Button>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline" 
              className="w-full"
            >
              Refresh Page
            </Button>
          </div>
          
          {/* Troubleshooting Tips */}
          <div className="mt-6 text-left text-xs text-gray-500">
            <p className="font-semibold mb-2">Troubleshooting:</p>
            <ul className="space-y-1">
              <li>• Check if you're logged in</li>
              <li>• Verify environment variables are set</li>
              <li>• Check if you have any teams in leagues</li>
              <li>• Check browser console for more details</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-between items-center mb-4">
            <Button 
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                router.push("/login");
              }}
              variant="outline"
              size="sm"
              className="border-red-700 text-red-400 hover:bg-red-900"
            >
              Logout
            </Button>
            <h1 className="text-4xl font-bold text-white">
              Your Leagues
            </h1>
            <Button 
              onClick={fetchUserLeagues}
              variant="outline"
              size="sm"
              className="border-neutral-700 text-white hover:bg-neutral-800"
            >
              Refresh
            </Button>
          </div>
          <p className="text-lg text-gray-300">
            Select a league to continue or create a new one
          </p>
          {leagues.length === 0 && (
            <p className="text-sm text-gray-400 mt-2">
              You don't have any leagues yet. Create your first league to get started!
            </p>
          )}
        </div>

        {/* League Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {leagues.map((league) => (
            <Card 
              key={league.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow bg-neutral-900 border-neutral-800 hover:border-neutral-700"
              onClick={() => handleSelectLeague(league.id)}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl text-white">{league.name}</CardTitle>
                    <p className="text-gray-400">Season {league.season}</p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {league.status && (
                      <Badge variant="outline" className="text-xs">
                        {league.status.replace(/_/g, " ")}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="bg-neutral-800 text-gray-300">
                      {league.team_count}/20 teams
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {league.my_team && (
                    <div className="flex items-center space-x-3">
                      {league.my_team.logo_url && (
                        <img
                          src={league.my_team.logo_url}
                          alt={`${league.my_team.name} logo`}
                          className="h-8 w-8 rounded-full"
                        />
                      )}
                      <div>
                        <p className="font-medium text-white">{league.my_team.name}</p>
                        <p className="text-sm text-gray-400">
                          {league.my_team.acronym}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <Users className="h-4 w-4" />
                    <span>{league.team_count} teams</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <Trophy className="h-4 w-4" />
                    <span>
                      {league.commissioner_user_id === "current_user" 
                        ? "Commissioner" 
                        : "Member"
                      }
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create League Button */}
        <div className="text-center">
          {leagues.length < 2 ? (
            <Button 
              onClick={handleCreateLeague}
              size="lg"
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-5 w-5" />
              <span>Create New League</span>
            </Button>
          ) : (
            <div className="text-gray-400">
              <p>You have reached the maximum of 2 leagues.</p>
              <p className="text-sm">Leave one of your current leagues to create a new one.</p>
            </div>
          )}
        </div>

        {/* Join League Option */}
        {leagues.length < 2 && (
          <div className="text-center mt-6">
            <Link href="/joinleague">
              <Button variant="outline" size="lg" className="border-neutral-700 text-white hover:bg-neutral-800">
                Join Existing League
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default SavesPage; 