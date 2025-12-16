"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { PerformanceData, TimePeriod, Metric } from "@/types";

export function usePerformanceData(
  companyId: string,
  timePeriod: TimePeriod,
  metric: Metric
) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!companyId) return;

      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const { currentStart, currentEnd, compareStart, compareEnd, currentLabel, compareLabel } =
          getDateRanges(timePeriod);

        console.log("📊 Performance Comparison Query:", {
          timePeriod,
          metric,
          currentStart,
          currentEnd,
          compareStart,
          compareEnd
        });

        // Fetch current period
        const { data: currentData, error: currentError } = await supabase
          .from("monthly_pl")
          .select("revenue, cogs, expenses, net_profit, month")
          .eq("company_id", companyId)
          .gte("month", currentStart)
          .lte("month", currentEnd);

        if (currentError) throw currentError;

        // Fetch comparison period
        const { data: compareData, error: compareError } = await supabase
          .from("monthly_pl")
          .select("revenue, cogs, expenses, net_profit, month")
          .eq("company_id", companyId)
          .gte("month", compareStart)
          .lte("month", compareEnd);

        if (compareError) throw compareError;

        console.log("📊 Data fetched:", {
          currentRows: currentData?.length || 0,
          compareRows: compareData?.length || 0
        });

        // Handle no data
        if ((!currentData || currentData.length === 0) && (!compareData || compareData.length === 0)) {
          setError("No data available for selected time period");
          setLoading(false);
          return;
        }

        // Calculate metrics
        const currentValue = calculateMetric(currentData || [], metric);
        const compareValue = calculateMetric(compareData || [], metric);
        const changeAmount = currentValue - compareValue;
        const changePercentage = compareValue !== 0 ? (changeAmount / Math.abs(compareValue)) * 100 : 0;

        // Determine if positive (reversed for COGS and Fixed Overhead)
        // Also check for neutral (within ±2%)
        const isReversedMetric = metric === "cogs" || metric === "fixed_overhead";
        const isNeutral = Math.abs(changePercentage) <= 2;
        let isPositive: boolean;
        
        if (isNeutral) {
          isPositive = true; // Neutral treated as positive for display
        } else if (isReversedMetric) {
          isPositive = changeAmount < 0; // Decrease is good for costs
        } else {
          isPositive = changeAmount > 0; // Increase is good for revenue/margin
        }

        // Generate AI insight
        const relatedMetrics = getRelatedMetrics(currentData || [], compareData || [], metric);
        const aiInsight = generateInsight(
          metric, 
          currentValue, 
          compareValue, 
          changePercentage, 
          isPositive, 
          isNeutral,
          relatedMetrics,
          currentLabel,
          compareLabel
        );

        setData({
          currentPeriod: {
            label: currentLabel,
            value: currentValue,
          },
          comparisonPeriod: {
            label: compareLabel,
            value: compareValue,
          },
          change: {
            amount: changeAmount,
            percentage: changePercentage,
            isPositive,
            isNeutral,
          },
          relatedMetrics,
          aiInsight,
        });
      } catch (err) {
        console.error("Performance data error:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [companyId, timePeriod, metric]);

  return { data, loading, error };
}

function getDateRanges(timePeriod: TimePeriod) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDay(); // 0 = Sunday
  
  // Helper to get start of week (Monday)
  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };
  
  // Helper to get quarter
  const getQuarter = (m: number) => Math.floor(m / 3);
  const getQuarterStart = (y: number, q: number) => new Date(y, q * 3, 1);
  const getQuarterEnd = (y: number, q: number) => new Date(y, q * 3 + 3, 0);

  let currentStart: string;
  let currentEnd: string;
  let compareStart: string;
  let compareEnd: string;
  let currentLabel: string;
  let compareLabel: string;

  switch (timePeriod) {
    case "last_week_vs_previous": {
      const lastWeekStart = getWeekStart(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
      const lastWeekEnd = new Date(lastWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      const prevWeekStart = new Date(lastWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      const prevWeekEnd = new Date(prevWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      currentStart = lastWeekStart.toISOString().split("T")[0];
      currentEnd = lastWeekEnd.toISOString().split("T")[0];
      compareStart = prevWeekStart.toISOString().split("T")[0];
      compareEnd = prevWeekEnd.toISOString().split("T")[0];
      currentLabel = `Week of ${lastWeekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      compareLabel = `Week of ${prevWeekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      break;
    }

    case "last_month_vs_previous": {
      currentStart = new Date(year, month - 1, 1).toISOString().split("T")[0];
      currentEnd = new Date(year, month, 0).toISOString().split("T")[0];
      compareStart = new Date(year, month - 2, 1).toISOString().split("T")[0];
      compareEnd = new Date(year, month - 1, 0).toISOString().split("T")[0];
      currentLabel = formatMonthLabel(new Date(year, month - 1, 1));
      compareLabel = formatMonthLabel(new Date(year, month - 2, 1));
      break;
    }

    case "last_quarter_vs_previous": {
      const lastQ = getQuarter(month) - 1;
      const lastQYear = lastQ < 0 ? year - 1 : year;
      const adjustedLastQ = lastQ < 0 ? 3 : lastQ;
      const prevQ = adjustedLastQ - 1;
      const prevQYear = prevQ < 0 ? lastQYear - 1 : lastQYear;
      const adjustedPrevQ = prevQ < 0 ? 3 : prevQ;
      
      currentStart = getQuarterStart(lastQYear, adjustedLastQ).toISOString().split("T")[0];
      currentEnd = getQuarterEnd(lastQYear, adjustedLastQ).toISOString().split("T")[0];
      compareStart = getQuarterStart(prevQYear, adjustedPrevQ).toISOString().split("T")[0];
      compareEnd = getQuarterEnd(prevQYear, adjustedPrevQ).toISOString().split("T")[0];
      currentLabel = `Q${adjustedLastQ + 1} ${lastQYear}`;
      compareLabel = `Q${adjustedPrevQ + 1} ${prevQYear}`;
      break;
    }

    case "last_year_vs_previous": {
      currentStart = new Date(year - 1, 0, 1).toISOString().split("T")[0];
      currentEnd = new Date(year - 1, 11, 31).toISOString().split("T")[0];
      compareStart = new Date(year - 2, 0, 1).toISOString().split("T")[0];
      compareEnd = new Date(year - 2, 11, 31).toISOString().split("T")[0];
      currentLabel = `${year - 1}`;
      compareLabel = `${year - 2}`;
      break;
    }

    case "this_week_vs_last_year": {
      const thisWeekStart = getWeekStart(now);
      const thisWeekEnd = new Date(thisWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      const lastYearWeekStart = new Date(thisWeekStart);
      lastYearWeekStart.setFullYear(lastYearWeekStart.getFullYear() - 1);
      const lastYearWeekEnd = new Date(lastYearWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      
      currentStart = thisWeekStart.toISOString().split("T")[0];
      currentEnd = thisWeekEnd.toISOString().split("T")[0];
      compareStart = lastYearWeekStart.toISOString().split("T")[0];
      compareEnd = lastYearWeekEnd.toISOString().split("T")[0];
      currentLabel = `Week of ${thisWeekStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      compareLabel = `Week of ${lastYearWeekStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      break;
    }

    case "this_month_vs_last_year": {
      currentStart = new Date(year, month, 1).toISOString().split("T")[0];
      currentEnd = now.toISOString().split("T")[0];
      compareStart = new Date(year - 1, month, 1).toISOString().split("T")[0];
      compareEnd = new Date(year - 1, month + 1, 0).toISOString().split("T")[0];
      currentLabel = formatMonthLabel(new Date(year, month, 1));
      compareLabel = formatMonthLabel(new Date(year - 1, month, 1));
      break;
    }

    case "this_quarter_vs_last_year": {
      const currentQ = getQuarter(month);
      currentStart = getQuarterStart(year, currentQ).toISOString().split("T")[0];
      currentEnd = now.toISOString().split("T")[0];
      compareStart = getQuarterStart(year - 1, currentQ).toISOString().split("T")[0];
      compareEnd = getQuarterEnd(year - 1, currentQ).toISOString().split("T")[0];
      currentLabel = `Q${currentQ + 1} ${year}`;
      compareLabel = `Q${currentQ + 1} ${year - 1}`;
      break;
    }

    case "this_year_vs_last_year":
    default: {
      currentStart = new Date(year, 0, 1).toISOString().split("T")[0];
      currentEnd = now.toISOString().split("T")[0];
      compareStart = new Date(year - 1, 0, 1).toISOString().split("T")[0];
      compareEnd = new Date(year - 1, 11, 31).toISOString().split("T")[0];
      currentLabel = `${year} YTD`;
      compareLabel = `${year - 1}`;
      break;
    }
  }

  return { currentStart, currentEnd, compareStart, compareEnd, currentLabel, compareLabel };
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function calculateMetric(data: any[], metric: Metric): number {
  if (!data || data.length === 0) return 0;

  const totals = data.reduce(
    (acc, row) => ({
      revenue: acc.revenue + (Number(row.revenue) || 0),
      cogs: acc.cogs + (Number(row.cogs) || 0),
      expenses: acc.expenses + (Number(row.expenses) || 0),
    }),
    { revenue: 0, cogs: 0, expenses: 0 }
  );

  switch (metric) {
    case "gross_revenue":
      return totals.revenue;
    case "cogs":
      return totals.cogs;
    case "gross_margin":
      return totals.revenue - totals.cogs;
    case "fixed_overhead":
      return totals.expenses;
    case "net_margin":
      return totals.revenue - totals.cogs - totals.expenses;
    default:
      return 0;
  }
}

function getRelatedMetrics(currentData: any[], compareData: any[], metric: Metric) {
  const current = {
    revenue: currentData.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0),
    cogs: currentData.reduce((sum, r) => sum + (Number(r.cogs) || 0), 0),
    expenses: currentData.reduce((sum, r) => sum + (Number(r.expenses) || 0), 0),
  };

  const compare = {
    revenue: compareData.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0),
    cogs: compareData.reduce((sum, r) => sum + (Number(r.cogs) || 0), 0),
    expenses: compareData.reduce((sum, r) => sum + (Number(r.expenses) || 0), 0),
  };

  const calcChange = (curr: number, prev: number) =>
    prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : 0;

  switch (metric) {
    case "gross_margin":
      return [
        { name: "Revenue", value: current.revenue, change: calcChange(current.revenue, compare.revenue) },
        { name: "COGS", value: current.cogs, change: calcChange(current.cogs, compare.cogs) },
      ];
    case "net_margin":
      return [
        { name: "Gross Margin", value: current.revenue - current.cogs, change: calcChange(current.revenue - current.cogs, compare.revenue - compare.cogs) },
        { name: "Fixed Overhead", value: current.expenses, change: calcChange(current.expenses, compare.expenses) },
      ];
    case "gross_revenue":
      return [
        { name: "COGS", value: current.cogs, change: calcChange(current.cogs, compare.cogs) },
        { name: "Gross Margin", value: current.revenue - current.cogs, change: calcChange(current.revenue - current.cogs, compare.revenue - compare.cogs) },
      ];
    default:
      return [
        { name: "Revenue", value: current.revenue, change: calcChange(current.revenue, compare.revenue) },
        { name: "Net Margin", value: current.revenue - current.cogs - current.expenses, change: calcChange(current.revenue - current.cogs - current.expenses, compare.revenue - compare.cogs - compare.expenses) },
      ];
  }
}

// Generate AI-style insight based on the data
// TODO: Replace with actual AI API (Gemini/Claude) for dynamic insights
function generateInsight(
  metric: Metric,
  currentValue: number,
  compareValue: number,
  changePercentage: number,
  isPositive: boolean,
  isNeutral: boolean,
  relatedMetrics: { name: string; value: number; change: number }[],
  currentLabel: string,
  compareLabel: string
): string {
  const metricNames: Record<Metric, string> = {
    gross_revenue: "revenue",
    cogs: "cost of goods sold",
    gross_margin: "gross margin",
    fixed_overhead: "fixed overhead",
    net_margin: "net margin",
  };

  const metricName = metricNames[metric];
  const absChange = Math.abs(changePercentage).toFixed(0);
  const direction = changePercentage >= 0 ? "increased" : "decreased";
  
  // Format currency for display
  const formatK = (v: number) => {
    if (Math.abs(v) >= 1000) {
      return `$${(v / 1000).toFixed(0)}K`;
    }
    return `$${v.toFixed(0)}`;
  };

  // Base insight
  let insight = "";

  if (isNeutral) {
    insight = `Your ${metricName} remained relatively stable compared to ${compareLabel}, with only a ${absChange}% change. `;
    insight += "This consistency suggests stable operations. ";
    insight += "Consider whether this is aligned with your growth goals or if there are opportunities to optimize.";
    return insight;
  }

  // Cost metrics (COGS, Fixed Overhead) - decrease is good
  if (metric === "cogs" || metric === "fixed_overhead") {
    if (isPositive) {
      // Costs decreased
      insight = `Great news! Your ${metricName} ${direction} by ${absChange}% compared to ${compareLabel}. `;
      if (relatedMetrics.length > 0) {
        const revenueMetric = relatedMetrics.find(m => m.name === "Revenue");
        if (revenueMetric && revenueMetric.change > 0) {
          insight += `Even better, revenue grew by ${revenueMetric.change.toFixed(0)}% while costs dropped. `;
        }
      }
      insight += "This efficiency improvement is boosting your bottom line. Keep monitoring what's working.";
    } else {
      // Costs increased
      insight = `Your ${metricName} ${direction} by ${absChange}% compared to ${compareLabel}. `;
      if (relatedMetrics.length > 0) {
        const revenueMetric = relatedMetrics.find(m => m.name === "Revenue");
        if (revenueMetric && revenueMetric.change > 0 && revenueMetric.change > changePercentage) {
          insight += `However, revenue growth (${revenueMetric.change.toFixed(0)}%) outpaced this increase, so margins may still be healthy. `;
        } else {
          insight += "Review your cost structure to identify areas for optimization. ";
        }
      }
      insight += "Consider negotiating with suppliers or improving operational efficiency.";
    }
    return insight;
  }

  // Revenue/Margin metrics - increase is good
  if (isPositive) {
    insight = `Your ${metricName} ${direction} by ${absChange}% compared to ${compareLabel}, reaching ${formatK(currentValue)}. `;
    
    if (metric === "gross_margin" && relatedMetrics.length > 0) {
      const cogsMetric = relatedMetrics.find(m => m.name === "COGS");
      const revMetric = relatedMetrics.find(m => m.name === "Revenue");
      if (cogsMetric && revMetric) {
        if (revMetric.change > cogsMetric.change) {
          insight += `This is excellent - you're scaling efficiently with revenue (${revMetric.change.toFixed(0)}%) growing faster than COGS (${cogsMetric.change.toFixed(0)}%). `;
        }
      }
    }
    
    if (metric === "gross_revenue") {
      insight += "Strong revenue growth indicates healthy demand. ";
      const marginMetric = relatedMetrics.find(m => m.name === "Gross Margin");
      if (marginMetric && marginMetric.change > 0) {
        insight += "Your margins are also improving, suggesting profitable growth.";
      } else {
        insight += "Monitor margins to ensure growth remains profitable.";
      }
    } else {
      insight += "Consider reinvesting this gain into growth initiatives while maintaining cost discipline.";
    }
  } else {
    insight = `Your ${metricName} ${direction} by ${absChange}% compared to ${compareLabel}, now at ${formatK(currentValue)}. `;
    
    if (metric === "gross_revenue") {
      insight += "This decline warrants attention. Review sales pipeline, marketing effectiveness, and market conditions. ";
    } else if (metric === "gross_margin") {
      const cogsMetric = relatedMetrics.find(m => m.name === "COGS");
      if (cogsMetric && cogsMetric.change > 0) {
        insight += `Rising COGS (${cogsMetric.change.toFixed(0)}%) is compressing margins. Review supplier contracts and production costs. `;
      }
    } else if (metric === "net_margin") {
      const overheadMetric = relatedMetrics.find(m => m.name === "Fixed Overhead");
      if (overheadMetric && overheadMetric.change > 0) {
        insight += `Increased overhead (${overheadMetric.change.toFixed(0)}%) is impacting net margin. Review fixed costs for optimization opportunities. `;
      }
    }
    insight += "Focus on cost optimization and revenue recovery strategies.";
  }

  return insight;
}