"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectionsChart } from "./ProjectionsChart";
import { useProjectionsData } from "@/hooks/useProjectionsData";
import { 
  MoreHorizontal, 
  TrendingUp, 
  TrendingDown,
  Calendar, 
  AlertCircle,
  Activity,
  RefreshCw,
  Info
} from "lucide-react";
import { ProjectionInsight } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  companyId: string;
}

// Insight icon mapping
const InsightIcon = ({ type, severity }: { type: string; severity?: string }) => {
  const iconClass = cn(
    "w-4 h-4 shrink-0",
    severity === "warning" && "text-orange-500 dark:text-orange-400",
    severity === "success" && "text-green-500 dark:text-green-400",
    severity === "info" && "text-blue-500 dark:text-blue-400"
  );

  switch (type) {
    case "seasonality":
      return <Calendar className={iconClass} />;
    case "trend":
      return <TrendingUp className={iconClass} />;
    case "recurring":
      return <AlertCircle className={iconClass} />;
    case "warning":
      return <AlertCircle className={iconClass} />;
    default:
      return <Info className={iconClass} />;
  }
};

export function ProjectionsWidget({ companyId }: Props) {
  const { data, insights, loading, error, isRealData } = useProjectionsData(companyId);

  // Calculate summary stats
  const projectedData = data.filter(d => d.isProjected);
  const historicalData = data.filter(d => !d.isProjected);
  
  const avgProjectedRevenue = projectedData.length > 0 
    ? projectedData.reduce((sum, d) => sum + d.revenue, 0) / projectedData.length 
    : 0;
  const avgHistoricalRevenue = historicalData.length > 0
    ? historicalData.reduce((sum, d) => sum + d.revenue, 0) / historicalData.length
    : 0;
  const revenueGrowth = avgHistoricalRevenue > 0 
    ? ((avgProjectedRevenue - avgHistoricalRevenue) / avgHistoricalRevenue) * 100 
    : 0;

  return (
    <Card className="bg-white dark:bg-gray-800/50 border-gray-200 dark:border-white/10 h-full shadow-sm overflow-hidden flex flex-col">
      <CardHeader className="pb-2 shrink-0 px-3 sm:px-4 pt-3 sm:pt-4">
        <div className="flex items-start sm:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Activity className="w-4 h-4 text-indigo-500 shrink-0" />
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">
              12-Month Projections
            </CardTitle>
            {/* Data source indicator */}
            {!loading && data.length > 0 && (
              <span className={cn(
                "text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wide",
                isRealData 
                  ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400"
                  : "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400"
              )}>
                {isRealData ? "Live" : "Demo"}
              </span>
            )}
          </div>
          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
        
        {/* Quick Stats */}
        {data.length > 0 && !loading && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2">
            <div className="flex items-center gap-1 sm:gap-1.5">
              {revenueGrowth >= 0 ? (
                <TrendingUp className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-green-500" />
              ) : (
                <TrendingDown className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-red-500" />
              )}
              <span className={cn(
                "text-[10px] sm:text-xs font-medium",
                revenueGrowth >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              )}>
                {revenueGrowth >= 0 ? "+" : ""}{revenueGrowth.toFixed(1)}% growth
              </span>
            </div>
            <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
              {historicalData.length} hist. • {projectedData.length} proj.
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 min-h-0 overflow-hidden flex flex-col p-4 pt-0">
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Loading projections...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}

        {data.length > 0 && !loading && (
          <>
            {/* Chart Area */}
            <div className="flex-1 min-h-0 mb-3">
              <ProjectionsChart data={data} />
            </div>

            {/* Insights Section */}
            {insights && insights.length > 0 && (
              <div className="shrink-0 border-t border-gray-100 dark:border-gray-700 pt-3">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  AI-Detected Insights
                </p>
                <div className="space-y-2">
                  {insights.slice(0, 3).map((insight, index) => (
                    <div 
                      key={index} 
                      className={cn(
                        "flex items-start gap-2 p-2 rounded-lg text-xs",
                        insight.severity === "warning" && "bg-orange-50 dark:bg-orange-500/10",
                        insight.severity === "success" && "bg-green-50 dark:bg-green-500/10",
                        insight.severity === "info" && "bg-blue-50 dark:bg-blue-500/10",
                        !insight.severity && "bg-gray-50 dark:bg-gray-700/50"
                      )}
                    >
                      <InsightIcon type={insight.type} severity={insight.severity} />
                      <span className="text-gray-700 dark:text-gray-300 leading-relaxed">
                        {insight.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {data.length === 0 && !loading && !error && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-4">
              <Activity className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                No projection data available yet
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Projections will improve as we collect more historical data
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
