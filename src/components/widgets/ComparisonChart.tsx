"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { Metric } from "@/types";

interface Props {
  currentPeriod: { label: string; value: number };
  comparisonPeriod: { label: string; value: number };
  isPositive: boolean;
  isNeutral?: boolean;
  metric: Metric;
}

export function ComparisonChart({
  currentPeriod,
  comparisonPeriod,
  isPositive,
  isNeutral = false,
  metric,
}: Props) {
  const data = [
    { period: currentPeriod.label, value: currentPeriod.value },
    { period: comparisonPeriod.label, value: comparisonPeriod.value },
  ];

  // Color coding:
  // - Green: Metric improved (revenue/margin up, costs down)
  // - Red: Metric declined (revenue/margin down, costs up)
  // - Yellow: No significant change (within ±2%)
  const getBarColor = (index: number) => {
    if (index === 0) {
      // Current period
      if (isNeutral) {
        return "#eab308"; // Yellow for neutral
      }
      return isPositive ? "#22c55e" : "#ef4444"; // Green or red
    }
    // Comparison period - always gray
    return "#9ca3af";
  };

  return (
    <div className="h-full min-h-[80px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 70 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="period"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            width={90}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={28}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(index)} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(value: any) => formatCurrency(Number(value))}
              style={{ fontSize: 12, fontWeight: 600, fill: "#e5e7eb" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}