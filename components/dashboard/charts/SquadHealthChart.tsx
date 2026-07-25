"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Users } from "lucide-react";
import { CHART_COLORS, chartAxisProps, chartGridProps, chartTooltipProps } from "./chart-theme";

export type SquadHealthGroup = {
  group: string;
  avgRating: number;
  count: number;
};

export function SquadHealthChart({ data }: { data: SquadHealthGroup[] }) {
  const hasPlayers = data.some((d) => d.count > 0);

  if (!hasPlayers) {
    return (
      <div className="h-[160px] flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Users className="h-6 w-6 text-faint-foreground" />
        No squad registered yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 32, left: 0, bottom: 0 }}
      >
        <CartesianGrid {...chartGridProps} horizontal={false} vertical />
        <XAxis type="number" domain={[0, 99]} {...chartAxisProps} />
        <YAxis type="category" dataKey="group" width={48} {...chartAxisProps} />
        <Tooltip
          {...chartTooltipProps}
          formatter={(value: number, _name, item) => [
            `${value.toFixed(1)} avg (${item.payload.count} players)`,
            "Rating",
          ]}
        />
        <Bar dataKey="avgRating" radius={[0, 3, 3, 0]} maxBarSize={22}>
          {data.map((d) => (
            <Cell key={d.group} fill={d.count > 0 ? CHART_COLORS.accent : "transparent"} fillOpacity={d.count > 0 ? 0.7 : 0} />
          ))}
          <LabelList
            dataKey="avgRating"
            position="right"
            formatter={(value) => {
              const rating = Number(value);
              return Number.isFinite(rating) && rating > 0 ? rating.toFixed(0) : "";
            }}
            style={{ fill: CHART_COLORS.mutedForeground, fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
