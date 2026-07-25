"use client";

import { Trophy } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS, chartAxisProps, chartGridProps, chartTooltipProps } from "./chart-theme";

export type PositionPoint = {
  round: number;
  position: number;
};

export function LeaguePositionChart({ data, totalTeams }: { data: PositionPoint[]; totalTeams: number }) {
  if (data.length === 0) {
    return (
      <div className="h-[160px] flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Trophy className="h-6 w-6 text-faint-foreground" />
        No matches played yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid {...chartGridProps} />
        <XAxis dataKey="round" tickFormatter={(r) => `R${r}`} {...chartAxisProps} />
        <YAxis
          reversed
          allowDecimals={false}
          domain={[1, totalTeams || "dataMax"]}
          tickFormatter={(p) => `#${p}`}
          {...chartAxisProps}
        />
        <Tooltip {...chartTooltipProps} formatter={(value: number) => [`#${value}`, "Position"]} labelFormatter={(r) => `Round ${r}`} />
        <Line
          type="monotone"
          dataKey="position"
          stroke={CHART_COLORS.accent}
          strokeWidth={2}
          dot={{ r: 3, fill: CHART_COLORS.accent, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
