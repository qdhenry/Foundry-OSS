"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ChartTooltip } from "./ChartTooltip";

interface MiniBarChartProps {
  data: Array<Record<string, string | number>>;
  dataKey: string;
  xKey?: string;
  height?: number;
  color?: string;
  formatter?: (value: number, name: string) => string;
}

export function MiniBarChart({
  data,
  dataKey,
  xKey = "label",
  height = 80,
  color = "var(--brand-blue-500)",
  formatter,
}: MiniBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 10, fill: "var(--text-muted)" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          content={<ChartTooltip formatter={formatter} />}
          cursor={{ fill: "var(--interactive-ghost)", opacity: 0.5 }}
        />
        <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}
