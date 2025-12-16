"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/widgets/KPICard";
import { PerformanceComparisonWidget } from "@/components/widgets/PerformanceComparisonWidget";
import { ProjectionsWidget } from "@/components/widgets/ProjectionsWidget";
import { useKPIData } from "@/hooks/useKPIData";

type TimeRange = "today" | "7d" | "30d" | "3m" | "ytd";

interface DashboardGridProps {
  companyId: string;
}

export function DashboardGrid({ companyId }: DashboardGridProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const { data: kpiData, loading: kpiLoading } = useKPIData(companyId);

  const timeRanges: { value: TimeRange; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "7d", label: "7D" },
    { value: "30d", label: "30D" },
    { value: "3m", label: "3M" },
    { value: "ytd", label: "YTD" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50 dark:bg-[#1a1f2e] transition-colors duration-300">
      {/* Widgets Grid - Scrollable */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
          {/* Row 1: KPIs + Performance Comparison */}
          {/* Mobile: Stack vertically, Tablet: 2 columns, Desktop: Original layout */}
          <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-6 lg:min-h-[500px]">
            {/* KPI Cards - Mobile: Full width side by side, Tablet: Stacked, Desktop: Left column */}
            <div className="grid grid-cols-2 sm:grid-cols-1 lg:col-span-3 gap-4 sm:gap-6">
              <div className="min-h-[140px] sm:min-h-[180px] lg:flex-1 lg:min-h-0">
                {kpiLoading ? (
                  <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-white/10 rounded-lg h-full flex items-center justify-center">
                    <div className="animate-pulse text-gray-400">Loading...</div>
                  </div>
                ) : (
                  <KPICard
                    title="Total Revenue"
                    value={kpiData?.totalRevenue ?? 0}
                    change={kpiData?.revenueChange ?? 0}
                    format="currency"
                  />
                )}
              </div>
              <div className="min-h-[140px] sm:min-h-[180px] lg:flex-1 lg:min-h-0">
                {kpiLoading ? (
                  <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-white/10 rounded-lg h-full flex items-center justify-center">
                    <div className="animate-pulse text-gray-400">Loading...</div>
                  </div>
                ) : (
                  <KPICard
                    title="Net Profit"
                    value={kpiData?.netProfit ?? 0}
                    change={kpiData?.netProfitChange ?? 0}
                    format="currency"
                  />
                )}
              </div>
            </div>

            {/* Performance Comparison - Mobile: Full width, Tablet/Desktop: Right side */}
            <div className="sm:col-span-1 lg:col-span-9 min-h-[300px] sm:min-h-[380px] lg:min-h-0">
              <PerformanceComparisonWidget companyId={companyId} />
            </div>
          </div>

          {/* Row 2: Projections + Drop Widget */}
          {/* Mobile: Stack vertically, Tablet/Desktop: Side by side */}
          <div className="shrink-0 grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6">
            <div className="md:col-span-8 min-h-[280px] sm:min-h-[320px] lg:min-h-[220px]">
              <ProjectionsWidget companyId={companyId} />
            </div>
            <div className="md:col-span-4 min-h-[120px] sm:min-h-[150px] lg:min-h-[220px]">
              <div className="bg-white dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-white/10 h-full flex flex-col items-center justify-center hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group">
                <div className="text-center text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300">
                  <Plus className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-xs font-medium">Drop Widget</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Time Range Selector - Fixed Footer */}
      <div className="shrink-0 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 py-3 sm:py-4 px-4 sm:px-6 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1f2e]">
        <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Time Range:</span>
        <div className="flex items-center gap-1">
          {timeRanges.map((range) => (
            <Button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              variant="ghost"
              size="sm"
              className={`text-xs sm:text-sm px-2 sm:px-3 ${
                timeRange === range.value
                  ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 font-medium hover:bg-indigo-200 dark:hover:bg-indigo-500/30"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
              }`}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
