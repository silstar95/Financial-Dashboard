"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: number;
  change: number;
  format: "currency" | "number" | "percentage";
  className?: string;
}

export function KPICard({ title, value, change, format, className }: KPICardProps) {
  const formattedValue =
    format === "currency"
      ? formatCurrency(value)
      : format === "percentage"
      ? `${value}%`
      : formatNumber(value);

  const isPositive = change >= 0;

  return (
    <Card className={cn("bg-white dark:bg-gray-800/50 border-gray-200 dark:border-white/10 shadow-sm h-full", className)}>
      <CardContent className="p-3 sm:p-4 h-full flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</p>
          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hidden sm:block">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xl sm:text-2xl lg:text-3xl font-bold mt-1 sm:mt-2 text-gray-900 dark:text-white">{formattedValue}</p>
        <div className="mt-1 sm:mt-2 flex flex-wrap items-center gap-1 sm:gap-0">
          <span
            className={`text-xs sm:text-sm px-1.5 sm:px-2 py-0.5 rounded font-medium ${
              isPositive
                ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
            }`}
          >
            {formatPercentage(change)}
          </span>
          <span className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 sm:ml-2">vs last period</span>
        </div>
      </CardContent>
    </Card>
  );
}