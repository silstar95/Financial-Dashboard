"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComparisonChart } from "./ComparisonChart";
import { usePerformanceData } from "@/hooks/usePerformanceData";
import { TimePeriod, Metric } from "@/types";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, MoreHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  companyId: string;
  className?: string;
}

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: "last_week_vs_previous", label: "Last Week vs Previous Week" },
  { value: "last_month_vs_previous", label: "Last Month vs Previous Month" },
  { value: "last_quarter_vs_previous", label: "Last Quarter vs Previous Quarter" },
  { value: "last_year_vs_previous", label: "Last Year vs Previous Year" },
  { value: "this_week_vs_last_year", label: "This Week vs Same Week Last Year" },
  { value: "this_month_vs_last_year", label: "This Month vs Same Month Last Year" },
  { value: "this_quarter_vs_last_year", label: "This Quarter vs Same Quarter Last Year" },
  { value: "this_year_vs_last_year", label: "This Year vs Last Year" },
];

const METRICS: { value: Metric; label: string }[] = [
  { value: "gross_revenue", label: "Gross Revenue" },
  { value: "cogs", label: "COGS" },
  { value: "gross_margin", label: "Gross Margin" },
  { value: "fixed_overhead", label: "Fixed Overhead" },
  { value: "net_margin", label: "Net Margin" },
];

export function PerformanceComparisonWidget({ companyId, className }: Props) {
  // Default: Last Month vs Same Month Last Year (Gross Revenue)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("this_month_vs_last_year");
  const [metric, setMetric] = useState<Metric>("gross_revenue");

  const { data, loading, error } = usePerformanceData(companyId, timePeriod, metric);

  return (
    <Card className={cn("bg-white dark:bg-gray-800/50 border-gray-200 dark:border-white/10 h-full shadow-sm overflow-hidden flex flex-col", className)}>
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
            Performance Comparison
          </CardTitle>
          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Dropdowns */}
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <Select
            value={timePeriod}
            onValueChange={(v) => setTimePeriod(v as TimePeriod)}
          >
            <SelectTrigger className="w-full sm:w-[260px] text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200">
              <SelectValue placeholder="Select time period" />
            </SelectTrigger>
            <SelectContent className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-white/10 shadow-lg">
              {TIME_PERIODS.map((period) => (
                <SelectItem key={period.value} value={period.value} className="text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800">
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={metric}
            onValueChange={(v) => setMetric(v as Metric)}
          >
            <SelectTrigger className="w-full sm:w-[160px] text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-white/10 shadow-lg">
              {METRICS.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 overflow-hidden">
        {loading && (
          <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
            Loading...
          </div>
        )}

        {error && (
          <div className="h-full flex items-center justify-center text-red-500 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {data && !loading && (
          <div className="h-full flex flex-col">
            {/* Chart */}
            <div className="flex-1 min-h-0">
              <ComparisonChart
                currentPeriod={data.currentPeriod}
                comparisonPeriod={data.comparisonPeriod}
                isPositive={data.change.isPositive}
                isNeutral={data.change.isNeutral}
                metric={metric}
              />
            </div>

            {/* Change Indicator */}
            <div className="flex items-center justify-center gap-2 py-2 shrink-0">
              {data.change.isNeutral ? (
                <Minus className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
              ) : data.change.isPositive ? (
                <TrendingUp className="w-5 h-5 text-green-500 dark:text-green-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-500 dark:text-red-400" />
              )}
              <span
                className={cn(
                  "text-lg font-semibold",
                  data.change.isNeutral 
                    ? "text-yellow-500 dark:text-yellow-400"
                    : data.change.isPositive 
                      ? "text-green-500 dark:text-green-400" 
                      : "text-red-500 dark:text-red-400"
                )}
              >
                {data.change.amount >= 0 ? "+" : ""}
                {formatCurrency(data.change.amount)} ({formatPercentage(data.change.percentage)})
                {data.change.isNeutral ? "" : data.change.isPositive ? " ↑" : " ↓"}
              </span>
            </div>

            {/* Related Metrics */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-2 shrink-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Related Metrics:</p>
              <div className="flex flex-wrap gap-4">
                {data.relatedMetrics.map((rm) => (
                  <div key={rm.name} className="text-xs">
                    <span className="text-gray-500 dark:text-gray-400">{rm.name}:</span>{" "}
                    <span className="font-medium text-gray-900 dark:text-gray-200">{formatCurrency(rm.value)}</span>{" "}
                    <span
                      className={cn(
                        Math.abs(rm.change) <= 2 
                          ? "text-yellow-500 dark:text-yellow-400"
                          : rm.change >= 0 
                            ? "text-green-500 dark:text-green-400" 
                            : "text-red-500 dark:text-red-400"
                      )}
                    >
                      ({formatPercentage(rm.change)})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Insights Section */}
            {data.aiInsight && (
              <div className="border-t border-gray-100 dark:border-gray-700 pt-2 mt-2 shrink-0">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500 dark:text-purple-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    {data.aiInsight}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}