// app/(dashboard)/hof/page.tsx
"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";

// mock HOF data
interface HofEntry {
  club: string;
  overall: number;
  last3: [number, number, number];
}
const hofData: HofEntry[] = [
  { club: "Atlético Madrid", overall: 50, last3: [25, 27, 50] },
  { club: "Liverpool", overall: 42, last3: [30, 27, 42] },
  { club: "Paris Saint-Germain", overall: 38, last3: [35, 33, 38] },
  { club: "AC Milan", overall: 39, last3: [40, 37, 39] },
  { club: "Southampton", overall: 35, last3: [20, 18, 35] },
  { club: "Inter Miami", overall: 33, last3: [15, 22, 33] },
  { club: "Bayern München", overall: 31, last3: [28, 29, 31] },
  { club: "AS Roma", overall: 31, last3: [30, 30, 31] },
  { club: "Stoke City", overall: 28, last3: [26, 27, 28] },
  { club: "Benfica", overall: 24, last3: [20, 22, 24] },
  { club: "SC Preußen Münster", overall: 21, last3: [10, 15, 21] },
  { club: "Go Ahead Eagles", overall: 15, last3: [5, 8, 15] },
];

// thresholds from the excel screenshot:
const LAST3_THRESHOLDS = { poor: 11, good: 23 };
const OVERALL_THRESHOLDS = { poor: 27, good: 41 };

function situationBadge(
  value: number,
  thresholds: { poor: number; good: number }
) {
  if (value >= thresholds.good)
    return <Badge variant="default">EXCELLENT!</Badge>;
  if (value <= thresholds.poor)
    return <Badge variant="destructive">POOR!</Badge>;
  return <Badge variant="secondary">OK</Badge>;
}

export default function HofPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">🏆 Hall of Fame Standings</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30px]">#</TableHead>
            <TableHead>Club</TableHead>
            <TableHead className="text-center">HOF Last 3</TableHead>
            <TableHead className="text-center">Situation</TableHead>
            <TableHead className="text-center">HOF Overall</TableHead>
            <TableHead className="text-center">Situation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {hofData
            .sort((a, b) => b.overall - a.overall)
            .map((entry, idx) => (
              <TableRow key={entry.club}>
                <TableCell>{idx + 1}</TableCell>
                <TableCell>{entry.club}</TableCell>
                <TableCell className="text-center">{entry.last3[2]}</TableCell>
                <TableCell className="text-center">
                  {situationBadge(entry.last3[2], LAST3_THRESHOLDS)}
                </TableCell>
                <TableCell className="text-center">{entry.overall}</TableCell>
                <TableCell className="text-center">
                  {situationBadge(entry.overall, OVERALL_THRESHOLDS)}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
