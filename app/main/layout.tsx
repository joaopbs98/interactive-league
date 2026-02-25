"use client";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { LeagueSettingsProvider } from "@/contexts/LeagueSettingsContext";
import { useLeague } from "@/contexts/LeagueContext";

function MainContent({ children }: { children: React.ReactNode }) {
  const { selectedTeam, loading } = useLeague();
  
  // Show loading state while context is initializing
  if (loading) {
    return <>{children}</>;
  }
  
  // If no team is selected or no league, just render children without the provider
  if (!selectedTeam?.leagues?.id) {
    return <>{children}</>;
  }

  // Wrap children with the LeagueSettingsProvider
  return (
    <LeagueSettingsProvider leagueId={selectedTeam.leagues.id}>
      {children}
    </LeagueSettingsProvider>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full bg-background min-h-screen">
        <SidebarTrigger />
        <MainContent>
          {children}
        </MainContent>
      </main>
    </SidebarProvider>
  );
}
