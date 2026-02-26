"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface RefreshContextType {
  refreshKey: number;
  triggerRefresh: () => void;
}

const RefreshContext = createContext<RefreshContextType | undefined>(undefined);

export function useRefresh() {
  const context = useContext(RefreshContext);
  if (context === undefined) {
    return {
      refreshKey: 0,
      triggerRefresh: () => {},
    };
  }
  return context;
}

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <RefreshContext.Provider value={{ refreshKey, triggerRefresh }}>
      {children}
    </RefreshContext.Provider>
  );
}
