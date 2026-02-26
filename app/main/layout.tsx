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
      <main className="w-full bg-background min-h-screen flex flex-col">
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4 md:px-6">
          <SidebarTrigger />
        </header>
        <div className="flex-1 overflow-x-auto p-4 md:p-6">
          <MainContent>
            {children}
          </MainContent>
        </div>
      </main>
    </SidebarProvider>
  );
}
