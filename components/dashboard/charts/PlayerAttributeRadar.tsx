"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "./chart-theme";

export type RadarStat = { label: string; value: number };

export function PlayerAttributeRadar({ data }: { data: RadarStat[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={data} outerRadius="75%">
        <PolarGrid stroke={CHART_COLORS.border} />
        <PolarAngleAxis dataKey="label" tick={{ fill: CHART_COLORS.mutedForeground, fontSize: 12 }} />
        <PolarRadiusAxis domain={[0, 99]} tick={false} axisLine={false} tickCount={4} />
        <Radar
          dataKey="value"
          stroke={CHART_COLORS.accent}
          fill={CHART_COLORS.accent}
          fillOpacity={0.28}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
