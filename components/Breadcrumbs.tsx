"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const LABELS: Record<string, string> = {
  main: "Dashboard",
  dashboard: "Overview",
  standings: "Standings",
  schedule: "Schedule",
  squad: "Squad",
  tactics: "Tactics",
  contracts: "Contracts",
  injuries: "Injuries",
  finances: "Finances",
  transactions: "Transactions",
  sponsors: "Sponsors",
  trades: "Trades",
  objectives: "Objectives",
  "team-comparison": "Team Comparison",
  "transfer-history": "Transfer History",
  compindex: "CompIndex",
  hof: "Hall of Fame",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => ({
    label: LABELS[seg] || seg.replace(/-/g, " "),
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  if (crumbs.length < 2) return null;

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
      {crumbs.map((c, i) => (
        <span key={c.href} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3" />}
          {c.isLast ? (
            <span className="font-medium text-foreground">{c.label}</span>
          ) : (
            <Link href={c.href} className="hover:text-foreground">
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
