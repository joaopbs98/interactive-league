"use client";

import { Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type FormRoundData = {
  round: number;
  points: number;
  result: "W" | "D" | "L" | null;
  scoreLine: string;
};

const resultStyles: Record<"W" | "D" | "L", string> = {
  W: "bg-status-positive/15 text-status-positive border-status-positive/30",
  D: "bg-status-neutral/15 text-status-neutral border-status-neutral/30",
  L: "bg-status-negative/15 text-status-negative border-status-negative/30",
};

export function FormStrip({ data }: { data: FormRoundData[] }) {
  if (data.length === 0) {
    return (
      <Card className="bg-surface border-border">
        <CardContent className="p-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4 text-faint-foreground" />
          No matches played yet — your recent form will appear here once the season kicks off.
        </CardContent>
      </Card>
    );
  }

  const wins = data.filter((d) => d.result === "W").length;
  const draws = data.filter((d) => d.result === "D").length;
  const losses = data.filter((d) => d.result === "L").length;

  return (
    <Card className="bg-surface border-border">
      <CardContent className="p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" /> Recent Form
          </h3>
          <p className="text-xs text-muted-foreground tabular-nums">
            <span className="text-status-positive font-semibold">{wins}W</span>{" "}
            <span className="text-status-neutral font-semibold">{draws}D</span>{" "}
            <span className="text-status-negative font-semibold">{losses}L</span>
            {" "}· last {data.length}
          </p>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {data.map((d) => (
            <div key={d.round} className="flex flex-col items-center gap-1.5 shrink-0">
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold border",
                  d.result ? resultStyles[d.result] : "border-border text-muted-foreground"
                )}
              >
                {d.result || "-"}
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">{d.scoreLine}</span>
              <span className="text-[10px] text-faint-foreground">R{d.round}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
