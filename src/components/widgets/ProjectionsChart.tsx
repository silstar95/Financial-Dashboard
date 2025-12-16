"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  ReferenceDot,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { ProjectionData, RecurringExpense } from "@/types";

interface Props {
  data: ProjectionData[];
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const isProjected = payload[0]?.payload?.isProjected;
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
          {label} {isProjected && <span className="text-xs text-gray-500">(Projected)</span>}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600 dark:text-gray-400">{entry.name}:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
        {payload[0]?.payload?.recurringExpenses?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
              ⚠️ Recurring Expenses:
            </p>
            {payload[0].payload.recurringExpenses.map((exp: RecurringExpense, i: number) => (
              <p key={i} className="text-xs text-gray-500 dark:text-gray-400">
                {exp.description}: {formatCurrency(exp.amount)}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }
  return null;
};

// Custom legend
const CustomLegend = ({ payload }: any) => {
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-2">
      {payload?.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-1.5">
          <div 
            className="w-4 h-0.5"
            style={{ 
              backgroundColor: entry.color,
              borderStyle: entry.payload?.strokeDasharray ? 'dashed' : 'solid',
            }}
          />
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export function ProjectionsChart({ data }: Props) {
  // Find the index where projections start
  const projectionStartIndex = data.findIndex((d) => d.isProjected);
  const projectionStartMonth = projectionStartIndex >= 0 ? data[projectionStartIndex].month : null;

  // Split data into historical and projected for different line styles
  const historicalData = data.filter(d => !d.isProjected);
  const projectedData = data.filter(d => d.isProjected);
  
  // Create combined data with null values for styling
  const chartData = data.map(d => ({
    ...d,
    // Historical values (null for projected months)
    historicalRevenue: !d.isProjected ? d.revenue : null,
    historicalCashFlow: !d.isProjected ? d.cashFlow : null,
    historicalNetProfit: !d.isProjected ? d.netProfit : null,
    // Projected values (null for historical months, but include last historical point for continuity)
    projectedRevenue: d.isProjected ? d.revenue : null,
    projectedCashFlow: d.isProjected ? d.cashFlow : null,
    projectedNetProfit: d.isProjected ? d.netProfit : null,
  }));

  // Add the last historical point to projected data for line continuity
  if (projectionStartIndex > 0 && chartData[projectionStartIndex - 1]) {
    const lastHistorical = data[projectionStartIndex - 1];
    chartData[projectionStartIndex - 1] = {
      ...chartData[projectionStartIndex - 1],
      projectedRevenue: lastHistorical.revenue,
      projectedCashFlow: lastHistorical.cashFlow,
      projectedNetProfit: lastHistorical.netProfit,
    };
  }

  // Find months with recurring expenses for markers
  const expenseMarkers = data
    .filter(d => d.recurringExpenses && d.recurringExpenses.length > 0)
    .map(d => ({
      month: d.month,
      expenses: d.recurringExpenses,
    }));

  return (
    <div className="h-full min-h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={chartData} 
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
          
          {/* X Axis */}
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            interval="preserveStartEnd"
          />
          
          {/* Left Y Axis - Revenue scale */}
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
            width={50}
          />
          
          {/* Right Y Axis - Profit/Cash Flow scale (may be different) */}
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
            width={50}
          />

          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />

          {/* Vertical line separating historical and projected */}
          {projectionStartMonth && (
            <ReferenceLine
              x={projectionStartMonth}
              stroke="#9ca3af"
              strokeDasharray="5 5"
              strokeWidth={2}
              yAxisId="left"
              label={{
                value: "Projected →",
                position: "top",
                fontSize: 10,
                fill: "#9ca3af",
                offset: 10,
              }}
            />
          )}

          {/* HISTORICAL LINES (Solid) */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="historicalRevenue"
            stroke="#22c55e"
            strokeWidth={2}
            dot={{ r: 3, fill: "#22c55e" }}
            name="Revenue"
            connectNulls={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="historicalCashFlow"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3, fill: "#3b82f6" }}
            name="Cash Flow"
            connectNulls={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="historicalNetProfit"
            stroke="#a855f7"
            strokeWidth={2}
            dot={{ r: 3, fill: "#a855f7" }}
            name="Net Profit"
            connectNulls={false}
          />

          {/* PROJECTED LINES (Dashed) */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="projectedRevenue"
            stroke="#22c55e"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3, fill: "#22c55e", strokeDasharray: "0" }}
            name="Revenue (Projected)"
            connectNulls={true}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="projectedCashFlow"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3, fill: "#3b82f6", strokeDasharray: "0" }}
            name="Cash Flow (Projected)"
            connectNulls={true}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="projectedNetProfit"
            stroke="#a855f7"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3, fill: "#a855f7", strokeDasharray: "0" }}
            name="Net Profit (Projected)"
            connectNulls={true}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
