"use client";

import { Wallet } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS, chartAxisProps, chartGridProps, chartTooltipProps } from "./chart-theme";

export type FinancePoint = {
  label: string;
  balance: number;
};

const formatMoney = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `€${(n / 1_000).toFixed(0)}K`;
  return `€${n}`;
};

export function FinanceTrendChart({ data }: { data: FinancePoint[] }) {
  if (data.length < 2) {
    return (
      <div className="h-[160px] flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Wallet className="h-6 w-6 text-faint-foreground" />
        Not enough transaction history yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="financeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...chartGridProps} />
        <XAxis dataKey="label" {...chartAxisProps} />
        <YAxis tickFormatter={formatMoney} width={56} {...chartAxisProps} />
        <Tooltip {...chartTooltipProps} formatter={(value: number) => [formatMoney(value), "Balance"]} />
        <Area
          type="monotone"
          dataKey="balance"
          stroke={CHART_COLORS.accent}
          strokeWidth={2}
          fill="url(#financeFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
