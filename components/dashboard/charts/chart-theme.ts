// Shared Recharts theming pulled from the dark Resend/Geist-editorial design tokens (app/globals.css)

export const CHART_COLORS = {
  accent: "#3b9eff",
  accentHover: "#63b3ff",
  positive: "#11ff99",
  warning: "#ffc53d",
  negative: "#ff2047",
  neutral: "#a1a4a5",
  gold: "#ffc53d",
  border: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(255,255,255,0.14)",
  mutedForeground: "rgba(252,253,255,0.7)",
  faintForeground: "#888e90",
  surface2: "#101012",
  surface3: "#06060a",
};

export const chartGridProps = {
  stroke: CHART_COLORS.border,
  strokeDasharray: "3 3",
  vertical: false,
};

export const chartAxisProps = {
  stroke: CHART_COLORS.border,
  tick: { fill: CHART_COLORS.mutedForeground, fontSize: 11 },
  tickLine: false,
  axisLine: false,
};

export const chartTooltipProps = {
  contentStyle: {
    background: CHART_COLORS.surface2,
    border: `1px solid ${CHART_COLORS.border}`,
    borderRadius: "8px",
    fontSize: "12px",
    padding: "8px 12px",
  },
  labelStyle: { color: CHART_COLORS.mutedForeground, marginBottom: 4 },
  itemStyle: { color: "#fcfdff" },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

export function resultToColor(result: "W" | "D" | "L" | null): string {
  if (result === "W") return CHART_COLORS.positive;
  if (result === "L") return CHART_COLORS.negative;
  if (result === "D") return CHART_COLORS.warning;
  return CHART_COLORS.neutral;
}
