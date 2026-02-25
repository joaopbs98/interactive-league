"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRefresh } from '@/contexts/RefreshContext';

interface LeagueSettings {
  transferWindowOpen: boolean;
  matchMode: 'SIMULATED' | 'MANUAL';
  leagueId: string | null;
}

interface LeagueSettingsContextType {
  settings: LeagueSettings;
  updateTransferWindow: (isOpen: boolean) => Promise<void>;
  updateMatchMode: (mode: 'SIMULATED' | 'MANUAL') => Promise<void>;
  isHost: boolean;
  loading: boolean;
}

const LeagueSettingsContext = createContext<LeagueSettingsContextType | undefined>(undefined);

export function LeagueSettingsProvider({ children, leagueId }: { children: React.ReactNode; leagueId: string }) {
  const { refreshKey } = useRefresh();
  const [settings, setSettings] = useState<LeagueSettings>({
    transferWindowOpen: false,
    matchMode: 'SIMULATED',
    leagueId: leagueId
  });
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch from API (DB-persisted)
        const res = await fetch(`/api/league/settings?leagueId=${leagueId}`);
        const json = await res.json();

        if (json.success && json.data) {
          setSettings(prev => ({
            ...prev,
            transferWindowOpen: json.data.transfer_window_open ?? (prev.transferWindowOpen ?? true),
            matchMode: json.data.match_mode ?? 'SIMULATED'
          }));
          setIsHost(json.data.is_host ?? false);
        } else {
          setIsHost(false);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching league settings:', error);
        setLoading(false);
      }
    };

    if (leagueId) {
      fetchSettings();
    }
  }, [leagueId, supabase.auth, refreshKey]);

  const updateTransferWindow = async (isOpen: boolean) => {
    if (!isHost) {
      throw new Error('Only the league host can update transfer window settings');
    }

    const res = await fetch('/api/league/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueId, transfer_window_open: isOpen })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to update');

    setSettings(prev => ({ ...prev, transferWindowOpen: isOpen }));
  };

  const updateMatchMode = async (mode: 'SIMULATED' | 'MANUAL') => {
    if (!isHost) {
      throw new Error('Only the league host can update match mode');
    }

    const res = await fetch('/api/league/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueId, match_mode: mode })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to update');

    setSettings(prev => ({ ...prev, matchMode: mode }));
  };

  return (
    <LeagueSettingsContext.Provider value={{
      settings,
      updateTransferWindow,
      updateMatchMode,
      isHost,
      loading
    }}>
      {children}
    </LeagueSettingsContext.Provider>
  );
}

export function useLeagueSettings() {
  const context = useContext(LeagueSettingsContext);
  if (context === undefined) {
    // Return a default context instead of throwing an error
    return {
      settings: {
        transferWindowOpen: false,
        matchMode: 'SIMULATED' as const,
        leagueId: null
      },
      updateTransferWindow: async () => { console.warn('LeagueSettingsProvider not available'); },
      updateMatchMode: async () => { console.warn('LeagueSettingsProvider not available'); },
      isHost: false,
      loading: false
    };
  }
  return context;
} 