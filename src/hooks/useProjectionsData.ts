"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProjectionData, ProjectionInsight, RecurringExpense } from "@/types";

// Use real data from Supabase when available
const USE_MOCK_DATA = false; // Set to true to force mock data

// Mock data for development/demo when database tables don't exist
const generateMockData = (): { data: ProjectionData[]; insights: ProjectionInsight[] } => {
  const months = [
    "Jan '24", "Feb '24", "Mar '24", "Apr '24", "May '24", "Jun '24",
    "Jul '24", "Aug '24", "Sep '24", "Oct '24", "Nov '24", "Dec '24",
    "Jan '25", "Feb '25", "Mar '25", "Apr '25", "May '25", "Jun '25",
    "Jul '25", "Aug '25", "Sep '25", "Oct '25", "Nov '25", "Dec '25"
  ];

  // Seasonality factors (December high, July low)
  const seasonality: Record<string, number> = {
    "Jan": 0.95, "Feb": 0.90, "Mar": 1.00, "Apr": 1.05,
    "May": 1.10, "Jun": 1.05, "Jul": 0.90, "Aug": 0.95,
    "Sep": 1.00, "Oct": 1.05, "Nov": 1.15, "Dec": 1.25
  };

  const baseRevenue = 85000;
  const baseCashFlow = 25000;
  const baseNetProfit = 15000;
  const yoyGrowth = 0.05; // 5% year-over-year growth

  const data: ProjectionData[] = months.map((month, index) => {
    const isProjected = index >= 12;
    const monthKey = month.split(" ")[0].replace("'", "");
    const factor = seasonality[monthKey] || 1.0;
    const growthMultiplier = Math.pow(1 + yoyGrowth / 12, index);

    // Add some randomness to historical data
    const variance = isProjected ? 1 : (0.95 + Math.random() * 0.1);

    const recurringExpenses: RecurringExpense[] = [];
    
    // Add recurring expenses for April (insurance)
    if (monthKey === "Apr" && isProjected) {
      recurringExpenses.push({
        description: "Annual Insurance Payment",
        amount: 12000,
        expected_date: month
      });
    }
    
    // Add quarterly tax payments
    if (["Mar", "Jun", "Sep", "Dec"].includes(monthKey) && isProjected) {
      recurringExpenses.push({
        description: "Quarterly Tax Payment",
        amount: 8500,
        expected_date: month
      });
    }

    return {
      month,
      revenue: Math.round(baseRevenue * factor * growthMultiplier * variance),
      cashFlow: Math.round(baseCashFlow * factor * growthMultiplier * variance),
      netProfit: Math.round(baseNetProfit * factor * growthMultiplier * variance),
      isProjected,
      seasonalityFactor: factor,
      recurringExpenses: recurringExpenses.length > 0 ? recurringExpenses : undefined,
    };
  });

  const insights: ProjectionInsight[] = [
    {
      type: "seasonality",
      message: "Seasonality detected: December typically +25%, July typically -10%",
      severity: "info"
    },
    {
      type: "recurring",
      message: "Recurring expense: $12K insurance payment due April 2025",
      severity: "warning"
    },
    {
      type: "trend",
      message: "Trend: +5% year-over-year growth based on historical data",
      severity: "success"
    }
  ];

  return { data, insights };
};

export function useProjectionsData(companyId: string) {
  const [data, setData] = useState<ProjectionData[]>([]);
  const [insights, setInsights] = useState<ProjectionInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRealData, setIsRealData] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!companyId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      // Use mock data if forced
      if (USE_MOCK_DATA) {
        const mockResult = generateMockData();
        setData(mockResult.data);
        setInsights(mockResult.insights);
        setIsRealData(false);
        setLoading(false);
        return;
      }

      try {
        console.log("=== SUPABASE CONNECTION TEST ===");
        
        const supabase = createClient();
        console.log("1. Supabase client created");
        console.log("2. Company ID:", companyId);
        
        // Test basic query
        console.log("3. Starting fetch from monthly_pl...");
        
        let fetchResult;
        try {
          fetchResult = await supabase
            .from("monthly_pl")
            .select("*")
            .limit(50);
          console.log("4. Fetch completed!");
          console.log("5. Result:", JSON.stringify(fetchResult, null, 2));
        } catch (fetchErr) {
          console.error("4. FETCH FAILED:", fetchErr);
          throw fetchErr;
        }

        const { data: allData, error: allError } = fetchResult;
        
        console.log("6. All data count:", allData?.length || 0);
        console.log("7. Error:", allError?.message || "none");
        
        if (allData && allData.length > 0) {
          console.log("8. First row:", allData[0]);
          console.log("9. Available company_ids:", [...new Set(allData.map((r: any) => r.company_id))]);
        }

        // Now filter by company
        const historicalData = allData?.filter((r: any) => r.company_id === companyId) || [];
        const histError = allError;
        
        console.log("10. Filtered data count:", historicalData.length);

        if (histError) {
          console.error("❌ Error fetching monthly_pl:", histError.message, histError.details, histError.hint);
          setError(`Failed to fetch data: ${histError.message}`);
          const mockResult = generateMockData();
          setData(mockResult.data);
          setInsights([{ type: "warning", message: `Using demo data. Error: ${histError.message}`, severity: "warning" }]);
          setIsRealData(false);
          setLoading(false);
          return;
        }

        if (historicalData && historicalData.length > 0) {
          // IMPORTANT: Sort by date first!
          const sortedData = [...historicalData].sort((a: any, b: any) => 
            new Date(a.month).getTime() - new Date(b.month).getTime()
          );
          
          console.log("✅ Using REAL data from Supabase monthly_pl table!");
          console.log("Data sorted by date. First:", sortedData[0]?.month, "Last:", sortedData[sortedData.length-1]?.month);
          
          // Transform historical data (now sorted)
          const historical: ProjectionData[] = sortedData.map((row: any) => ({
            month: new Date(row.month).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
            revenue: Number(row.revenue) || 0,
            cashFlow: (Number(row.revenue) || 0) - (Number(row.expenses) || 0) - (Number(row.cogs) || 0),
            netProfit: Number(row.net_profit) || 0,
            isProjected: false,
          }));
          
          console.log("Historical data transformed:", historical.map(h => h.month).join(", "));

          // Generate projections based on historical data (use sorted data)
          const projections = generateProjectionsFromHistorical(sortedData);
          
          console.log("Projections generated:", projections.map(p => p.month).join(", "));

          // Combine historical and projected
          const combinedData = [...historical, ...projections];
          setData(combinedData);
          setIsRealData(true);
          
          // Generate insights from real data
          const generatedInsights = generateInsightsFromHistorical(historicalData);
          setInsights(generatedInsights);
        } else {
          // No data in database, use mock
          console.log("⚠️ No historical data found, using MOCK data");
          const mockResult = generateMockData();
          setData(mockResult.data);
          setInsights(mockResult.insights);
          setIsRealData(false);
        }
      } catch (err) {
        console.error("❌ Error fetching projections:", err);
        // Fall back to mock data on error
        const mockResult = generateMockData();
        setData(mockResult.data);
        setInsights(mockResult.insights);
        setIsRealData(false);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [companyId]);

  return { data, insights, loading, error, isRealData };
}

// Generate 12 months of projections based on historical patterns
function generateProjectionsFromHistorical(historicalData: any[]): ProjectionData[] {
  if (historicalData.length === 0) return [];

  // Calculate seasonality factors by month
  const monthlyAverages: Record<number, { revenue: number[]; cashFlow: number[]; netProfit: number[] }> = {};
  
  historicalData.forEach((row) => {
    const month = new Date(row.month).getMonth();
    if (!monthlyAverages[month]) {
      monthlyAverages[month] = { revenue: [], cashFlow: [], netProfit: [] };
    }
    monthlyAverages[month].revenue.push(Number(row.revenue) || 0);
    monthlyAverages[month].cashFlow.push((Number(row.revenue) || 0) - (Number(row.expenses) || 0) - (Number(row.cogs) || 0));
    monthlyAverages[month].netProfit.push(Number(row.net_profit) || 0);
  });

  // Calculate overall averages
  const totalRevenue = historicalData.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0);
  const avgRevenue = totalRevenue / historicalData.length;
  
  const totalCashFlow = historicalData.reduce((sum, r) => sum + ((Number(r.revenue) || 0) - (Number(r.expenses) || 0) - (Number(r.cogs) || 0)), 0);
  const avgCashFlow = totalCashFlow / historicalData.length;
  
  const totalNetProfit = historicalData.reduce((sum, r) => sum + (Number(r.net_profit) || 0), 0);
  const avgNetProfit = totalNetProfit / historicalData.length;
  
  console.log("📊 Projection Calculation Averages:", {
    avgRevenue: avgRevenue.toFixed(2),
    avgCashFlow: avgCashFlow.toFixed(2),
    avgNetProfit: avgNetProfit.toFixed(2),
    totalMonths: historicalData.length
  });

  // Calculate YoY growth rate
  const sortedData = [...historicalData].sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  let yoyGrowth = 0.05; // Default 5%
  
  if (sortedData.length >= 12) {
    const firstHalf = sortedData.slice(0, Math.floor(sortedData.length / 2));
    const secondHalf = sortedData.slice(Math.floor(sortedData.length / 2));
    const firstTotal = firstHalf.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0);
    const secondTotal = secondHalf.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0);
    if (firstTotal > 0) {
      yoyGrowth = (secondTotal - firstTotal) / firstTotal;
    }
  }
  
  // Cap growth between -30% and +50%
  yoyGrowth = Math.max(-0.30, Math.min(0.50, yoyGrowth));

  // Get last known values
  const lastData = sortedData[sortedData.length - 1];
  const lastDate = new Date(lastData.month);
  
  // Generate 12 months of projections
  const projections: ProjectionData[] = [];
  
  for (let i = 1; i <= 12; i++) {
    const projDate = new Date(lastDate);
    projDate.setMonth(projDate.getMonth() + i);
    const projMonth = projDate.getMonth();
    
    // Calculate seasonality factor for this month
    let seasonalityFactor = 1.0;
    if (monthlyAverages[projMonth] && monthlyAverages[projMonth].revenue.length > 0) {
      const monthAvg = monthlyAverages[projMonth].revenue.reduce((a, b) => a + b, 0) / monthlyAverages[projMonth].revenue.length;
      seasonalityFactor = avgRevenue > 0 ? monthAvg / avgRevenue : 1.0;
    }

    // Apply growth and seasonality
    const growthMultiplier = Math.pow(1 + yoyGrowth / 12, i);
    
    const projRevenue = avgRevenue * growthMultiplier * seasonalityFactor;
    const projCashFlow = avgCashFlow * growthMultiplier * seasonalityFactor;
    const projNetProfit = avgNetProfit * growthMultiplier * seasonalityFactor;

    projections.push({
      month: projDate.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      revenue: Math.round(projRevenue * 100) / 100,
      cashFlow: Math.round(projCashFlow * 100) / 100,
      netProfit: Math.round(projNetProfit * 100) / 100,
      isProjected: true,
      seasonalityFactor,
    });
  }

  return projections;
}

// Generate insights from historical data
function generateInsightsFromHistorical(historicalData: any[]): ProjectionInsight[] {
  const insights: ProjectionInsight[] = [];

  if (historicalData.length < 2) {
    insights.push({
      type: "warning",
      message: "More historical data needed for accurate projections",
      severity: "warning"
    });
    return insights;
  }

  // Calculate YoY growth
  const sortedData = [...historicalData].sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  
  if (sortedData.length >= 12) {
    const firstHalf = sortedData.slice(0, Math.floor(sortedData.length / 2));
    const secondHalf = sortedData.slice(Math.floor(sortedData.length / 2));
    const firstTotal = firstHalf.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0);
    const secondTotal = secondHalf.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0);
    
    if (firstTotal > 0) {
      const growth = ((secondTotal - firstTotal) / firstTotal) * 100;
      insights.push({
        type: "trend",
        message: `Trend: ${growth > 0 ? "+" : ""}${growth.toFixed(0)}% revenue growth over the period`,
        severity: growth > 0 ? "success" : "warning"
      });
    }
  }

  // Analyze seasonality
  const monthlyRevenue: Record<number, number[]> = {};
  historicalData.forEach((row) => {
    const month = new Date(row.month).getMonth();
    if (!monthlyRevenue[month]) monthlyRevenue[month] = [];
    monthlyRevenue[month].push(Number(row.revenue) || 0);
  });

  const monthNames = ["January", "February", "March", "April", "May", "June", 
                      "July", "August", "September", "October", "November", "December"];
  
  const avgRevenue = historicalData.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0) / historicalData.length;
  
  let highMonth = "";
  let highPct = 0;
  let lowMonth = "";
  let lowPct = 0;

  Object.entries(monthlyRevenue).forEach(([month, revenues]) => {
    const monthAvg = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    const pctDiff = avgRevenue > 0 ? ((monthAvg - avgRevenue) / avgRevenue) * 100 : 0;
    
    if (pctDiff > highPct) {
      highPct = pctDiff;
      highMonth = monthNames[parseInt(month)];
    }
    if (pctDiff < lowPct) {
      lowPct = pctDiff;
      lowMonth = monthNames[parseInt(month)];
    }
  });

  if (Math.abs(highPct) > 10 || Math.abs(lowPct) > 10) {
    insights.push({
      type: "seasonality",
      message: `Seasonality: ${highMonth} typically +${Math.round(highPct)}%, ${lowMonth} typically ${Math.round(lowPct)}%`,
      severity: "info"
    });
  }

  // Profitability insight
  const avgNetProfit = historicalData.reduce((sum, r) => sum + (Number(r.net_profit) || 0), 0) / historicalData.length;
  const profitMargin = avgRevenue > 0 ? (avgNetProfit / avgRevenue) * 100 : 0;
  
  insights.push({
    type: avgNetProfit > 0 ? "trend" : "warning",
    message: `Average profit margin: ${profitMargin.toFixed(1)}% (${avgNetProfit > 0 ? "profitable" : "needs attention"})`,
    severity: avgNetProfit > 0 ? "success" : "warning"
  });

  return insights;
}

function generateInsightsFromData(historical: any[], projections: any[]): ProjectionInsight[] {
  const insights: ProjectionInsight[] = [];

  // Seasonality insight
  if (projections.length > 0) {
    const highSeason = projections.find((p) => Number(p.seasonality_factor) > 1.1);
    const lowSeason = projections.find((p) => Number(p.seasonality_factor) < 0.95);

    if (highSeason || lowSeason) {
      const highMonth = highSeason ? new Date(highSeason.month).toLocaleDateString("en-US", { month: "long" }) : "December";
      const lowMonth = lowSeason ? new Date(lowSeason.month).toLocaleDateString("en-US", { month: "long" }) : "July";
      const highPct = highSeason ? Math.round((Number(highSeason.seasonality_factor) - 1) * 100) : 25;
      const lowPct = lowSeason ? Math.round((1 - Number(lowSeason.seasonality_factor)) * 100) : 10;
      
      insights.push({
        type: "seasonality",
        message: `Seasonality detected: ${highMonth} typically +${highPct}%, ${lowMonth} typically -${lowPct}%`,
        severity: "info"
      });
    }
  }

  // Recurring expenses insight
  const upcomingExpenses = projections
    .filter(p => p.recurring_expenses_flagged && p.recurring_expenses_flagged.length > 0)
    .slice(0, 1);
  
  if (upcomingExpenses.length > 0 && upcomingExpenses[0].recurring_expenses_flagged?.[0]) {
    const expense = upcomingExpenses[0].recurring_expenses_flagged[0];
    const expMonth = new Date(upcomingExpenses[0].month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    insights.push({
      type: "recurring",
      message: `Recurring expense: $${(expense.amount / 1000).toFixed(0)}K ${expense.description} due ${expMonth}`,
      severity: "warning"
    });
  }

  // Trend insight
  if (historical.length >= 12) {
    const firstHalf = historical.slice(0, 6).reduce((sum, r) => sum + (Number(r.revenue) || 0), 0);
    const secondHalf = historical.slice(6).reduce((sum, r) => sum + (Number(r.revenue) || 0), 0);
    const growth = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

    if (Math.abs(growth) > 3) {
      insights.push({
        type: "trend",
        message: `Trend: ${growth > 0 ? "+" : ""}${growth.toFixed(0)}% year-over-year growth`,
        severity: growth > 0 ? "success" : "warning"
      });
    }
  }

  // Default insights if none generated
  if (insights.length === 0) {
    insights.push({
      type: "trend",
      message: "Collecting data to generate insights...",
      severity: "info"
    });
  }

  return insights;
}
