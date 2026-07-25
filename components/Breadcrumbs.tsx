"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

// Route segments that have no page.tsx of their own (only dynamic child routes),
// so they should render as plain text rather than a clickable link.
const NO_PAGE_SEGMENTS = new Set(["players", "team", "matches"]);

const LABELS: Record<string, string> = {
  main: "Dashboard",
  dashboard: "Overview",
  standings: "Standings",
  schedule: "Schedule",
  matches: "Matches",
  squad: "Squad",
  players: "Players",
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
  "players-database": "Players Database",
  freeagents: "Free Agents",
  "transfer-list": "Transfer List",
  auctions: "Auctions",
  draft: "Draft",
  loans: "Loans",
  packs: "Packs",
  stats: "History & Stats",
  "insert-results": "Insert Results",
  "add-player": "Add Player",
  "host-controls": "Host Controls",
  "eafc-setup": "EAFC Setup",
  stadium: "Stadium",
  settings: "Settings",
  admin: "Admin",
  "host-manual": "Host Manual",
  "youngster-upgrades": "Youngster Upgrades",
};

export function Breadcrumbs({ lastLabel }: { lastLabel?: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => {
    const isLast = i === segments.length - 1;
    return {
      label: isLast && lastLabel ? lastLabel : LABELS[seg] || seg.replace(/-/g, " "),
      href: "/" + segments.slice(0, i + 1).join("/"),
      isLast,
      isLink: !NO_PAGE_SEGMENTS.has(seg),
    };
  });

  if (crumbs.length < 2) return null;

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
      {crumbs.map((c, i) => (
        <span key={c.href} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3" />}
          {c.isLast ? (
            <span className="font-medium text-foreground">{c.label}</span>
          ) : c.isLink ? (
            <Link href={c.href} className="hover:text-foreground">
              {c.label}
            </Link>
          ) : (
            <span>{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
