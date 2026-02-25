"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRefresh } from '@/contexts/RefreshContext';

interface LeagueContextType {
  selectedLeagueId: string | null;
  selectedTeam: any | null;
  setSelectedLeague: (leagueId: string, team?: any) => void;
  clearSelection: () => void;
  refreshTeamData: () => Promise<void>;
  isLeagueSelected: boolean;
  loading: boolean;
}

const LeagueContext = createContext<LeagueContextType | undefined>(undefined);

export const useLeague = () => {
  const context = useContext(LeagueContext);
  if (context === undefined) {
    throw new Error('useLeague must be used within a LeagueProvider');
  }
  return context;
};

interface LeagueProviderProps {
  children: ReactNode;
}

export const LeagueProvider: React.FC<LeagueProviderProps> = ({ children }) => {
  const { refreshKey } = useRefresh();
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Fetch team by leagueId (used when we have leagueId but no team)
  const fetchTeamByLeagueId = useCallback(async (leagueId: string) => {
    try {
      const res = await fetch(`/api/user/team/${leagueId}`);
      const data = await res.json();
      if (data.success && data.team) {
        const team = { ...data.team, league_id: leagueId, leagues: data.league };
        setSelectedTeam(team);
        localStorage.setItem('selectedTeam', JSON.stringify(team));
        return team;
      }
    } catch (error) {
      console.error('LeagueContext: Error fetching team by leagueId:', error);
    }
    return null;
  }, []);

  // Load from localStorage and fetch complete team data
  useEffect(() => {
    const loadTeamData = async () => {
      const savedLeagueId = localStorage.getItem('selectedLeagueId');
      const savedTeam = localStorage.getItem('selectedTeam');
      
      if (savedLeagueId) {
        setSelectedLeagueId(savedLeagueId);
      }
      
      if (savedTeam) {
        try {
          const parsedTeam = JSON.parse(savedTeam);
          setSelectedTeam(parsedTeam);
          
          // Fetch complete team data with league info
          if (parsedTeam.id) {
            const { data: completeTeam, error } = await supabase
              .from('teams')
              .select(`
                *,
                leagues (*)
              `)
              .eq('id', parsedTeam.id)
              .single();
            
            if (completeTeam && !error) {
              setSelectedTeam(completeTeam);
              localStorage.setItem('selectedTeam', JSON.stringify(completeTeam));
            } else {
              // Team no longer exists (deleted league) -- try to fetch by leagueId
              if (savedLeagueId) {
                const team = await fetchTeamByLeagueId(savedLeagueId);
                if (!team) {
                  setSelectedLeagueId(null);
                  setSelectedTeam(null);
                  localStorage.removeItem('selectedLeagueId');
                  localStorage.removeItem('selectedTeam');
                }
              } else {
                setSelectedLeagueId(null);
                setSelectedTeam(null);
                localStorage.removeItem('selectedLeagueId');
                localStorage.removeItem('selectedTeam');
              }
            }
          }
        } catch (error) {
          console.error('Error parsing saved team:', error);
          localStorage.removeItem('selectedTeam');
          if (savedLeagueId) {
            await fetchTeamByLeagueId(savedLeagueId);
          }
        }
      } else if (savedLeagueId) {
        // Have leagueId but no team - fetch team (e.g. user selected league from Saves without full team)
        await fetchTeamByLeagueId(savedLeagueId);
      }
      
      setLoading(false);
    };

    loadTeamData();
  }, [supabase, fetchTeamByLeagueId]);

  const setSelectedLeague = useCallback((leagueId: string, team?: any) => {
    setSelectedLeagueId(leagueId);
    if (team) {
      setSelectedTeam(team);
      localStorage.setItem('selectedTeam', JSON.stringify(team));
    } else {
      // Fetch team when only leagueId is passed (e.g. from Saves page)
      fetchTeamByLeagueId(leagueId);
    }
    localStorage.setItem('selectedLeagueId', leagueId);
  }, [fetchTeamByLeagueId]);

  const clearSelection = () => {
    setSelectedLeagueId(null);
    setSelectedTeam(null);
    localStorage.removeItem('selectedLeagueId');
    localStorage.removeItem('selectedTeam');
  };

  const refreshTeamData = useCallback(async () => {
    if (!selectedTeam?.id) return;
    try {
      const { data: completeTeam, error } = await supabase
        .from('teams')
        .select(`*, leagues (*)`)
        .eq('id', selectedTeam.id)
        .single();
      if (completeTeam && !error) {
        setSelectedTeam(completeTeam);
        localStorage.setItem('selectedTeam', JSON.stringify(completeTeam));
      }
    } catch (err) {
      console.error('LeagueContext: refreshTeamData error:', err);
    }
  }, [selectedTeam?.id, supabase]);

  useEffect(() => {
    if (refreshKey > 0 && selectedTeam?.id) {
      refreshTeamData();
    }
  }, [refreshKey, selectedTeam?.id, refreshTeamData]);

  const isLeagueSelected = !!selectedLeagueId;

  return (
    <LeagueContext.Provider
      value={{
        selectedLeagueId,
        selectedTeam,
        setSelectedLeague,
        clearSelection,
        refreshTeamData,
        isLeagueSelected,
        loading,
      }}
    >
      {children}
    </LeagueContext.Provider>
  );
}; 