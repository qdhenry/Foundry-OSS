"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";

interface AreaTimelineProps {
  data: Array<Record<string, string | number>>;
  dataKey: string;
  xKey?: string;
  height?: number;
  color?: string;
  formatter?: (value: number, name: string) => string;
  showGrid?: boolean;
  showAxis?: boolean;
}

export function AreaTimeline({
  data,
  dataKey,
  xKey = "date",
  height = 120,
  color = "var(--brand-blue-500)",
  formatter,
  showGrid = false,
  showAxis = true,
}: AreaTimelineProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
        )}
        {showAxis && (
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={false}
          />
        )}
        {showAxis && (
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
        )}
        <Tooltip content={<ChartTooltip formatter={formatter} />} />
        <defs>
          <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#gradient-${dataKey})`}
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: "var(--surface-default)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
