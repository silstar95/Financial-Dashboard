"use client";

import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

export function LoadingSpinner({ size = "md", className, text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-8 h-8 border-3",
    lg: "w-12 h-12 border-4",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div
        className={cn(
          "animate-spin rounded-full border-indigo-200 border-t-indigo-600 dark:border-indigo-800 dark:border-t-indigo-400",
          sizeClasses[size]
        )}
      />
      {text && (
        <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">{text}</p>
      )}
    </div>
  );
}

export function FullPageLoading({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#1a1f2e]">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}

export function DashboardLoading() {
  return (
    <div className="flex h-screen w-full bg-gray-50 dark:bg-[#1a1f2e] overflow-hidden">
      {/* Sidebar skeleton */}
      <div className="w-[15%] h-full shrink-0 border-r border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1f2e]">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="w-20 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="px-4 py-4 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>

      {/* Hub Assistant skeleton */}
      <div className="w-[25%] h-full shrink-0 border-r border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1f2e]">
        <div className="p-6">
          <div className="w-32 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: `${80 - i * 15}%` }} />
            ))}
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="w-[60%] h-full flex flex-col shrink-0 bg-gray-50 dark:bg-[#1a1f2e]">
        {/* Header skeleton */}
        <div className="h-16 border-b border-gray-200 dark:border-white/10 flex items-center justify-between px-6">
          <div className="w-32 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Content skeleton */}
        <div className="flex-1 p-6">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-3 space-y-6">
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
            </div>
            <div className="col-span-9">
              <div className="h-[280px] bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-12 gap-6 mt-6">
            <div className="col-span-8">
              <div className="h-[180px] bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
            </div>
            <div className="col-span-4">
              <div className="h-[180px] bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

