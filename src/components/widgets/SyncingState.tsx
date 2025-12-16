"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, AlertCircle, Clock, CheckCircle2, Database } from "lucide-react";

interface SyncingStateProps {
  status: "pending" | "in_progress" | "failed" | "needs_sync";
  errorMessage?: string | null;
  onRetry?: () => void;
  companyName?: string;
}

async function triggerManualSync() {
  const response = await fetch("/api/qbo/trigger-sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to trigger sync");
  }
  
  return response.json();
}

export function SyncingState({ status, errorMessage, onRetry, companyName }: SyncingStateProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState(0);

  // Simulate progress animation when syncing
  useEffect(() => {
    if (isRetrying || status === "pending" || status === "in_progress") {
      const interval = setInterval(() => {
        setSyncProgress(prev => {
          // Slowly progress to 90%, never reach 100% until complete
          if (prev < 90) return prev + Math.random() * 5;
          return prev;
        });
      }, 500);
      return () => clearInterval(interval);
    } else {
      setSyncProgress(0);
    }
  }, [isRetrying, status]);

  // Auto-refresh status while syncing
  useEffect(() => {
    if (isRetrying) {
      const interval = setInterval(() => {
        console.log("🔄 [SyncingState] Checking for data...");
        if (onRetry) onRetry();
      }, 3000); // Check every 3 seconds
      return () => clearInterval(interval);
    }
  }, [isRetrying, onRetry]);

  const handleRetry = async () => {
    console.log("🔄 [SyncingState] Starting sync...");
    setIsRetrying(true);
    setRetryError(null);
    setSyncProgress(10);
    
    try {
      await triggerManualSync();
      console.log("🔄 [SyncingState] Sync triggered successfully, waiting for data...");
      // Keep isRetrying true - will be set to false when data appears
      // The parent component will re-render with hasData=true
    } catch (err) {
      console.error("🔄 [SyncingState] Sync failed:", err);
      setRetryError(err instanceof Error ? err.message : "Failed to trigger sync");
      setIsRetrying(false);
    }
  };

  const getStatusContent = () => {
    // Show syncing state when retry is in progress
    if (isRetrying) {
      return {
        icon: <Database className="w-16 h-16 text-indigo-500 animate-pulse" />,
        title: "Fetching Your Data",
        description: "We're connecting to QuickBooks and importing your financial data. This may take 30-60 seconds...",
        showSpinner: true,
        showProgress: true,
      };
    }

    switch (status) {
      case "pending":
        return {
          icon: <Clock className="w-16 h-16 text-amber-500 animate-pulse" />,
          title: "Sync Queued",
          description: "Your QuickBooks data is queued for syncing. This usually starts within a minute.",
          showSpinner: true,
          showProgress: true,
        };
      case "in_progress":
        return {
          icon: <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />,
          title: "Syncing Your Data",
          description: "We're pulling your QuickBooks data. This may take a few minutes for accounts with years of history.",
          showSpinner: true,
          showProgress: true,
        };
      case "failed":
        return {
          icon: <AlertCircle className="w-16 h-16 text-red-500" />,
          title: "Sync Failed",
          description: errorMessage || "Something went wrong while syncing your data. Please try again.",
          showSpinner: false,
          showProgress: false,
        };
      case "needs_sync":
        return {
          icon: <RefreshCw className="w-16 h-16 text-gray-400" />,
          title: "No Data Yet",
          description: "Your QuickBooks account is connected, but no data has been synced yet.",
          showSpinner: false,
          showProgress: false,
        };
      default:
        return {
          icon: <Loader2 className="w-16 h-16 text-gray-400" />,
          title: "Loading...",
          description: "Please wait...",
          showSpinner: true,
          showProgress: false,
        };
    }
  };

  const content = getStatusContent();

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50 dark:bg-[#1a1f2e] transition-colors duration-300">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          <Card className="bg-white dark:bg-gray-800/50 border-gray-200 dark:border-white/10 shadow-lg">
            <CardContent className="p-8 sm:p-12">
              {/* Icon */}
              <div className="flex justify-center mb-6">
                {content.icon}
              </div>

              {/* Company Name */}
              {companyName && (
                <div className="text-center mb-4">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    {companyName}
                  </span>
                </div>
              )}

              {/* Title & Description */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  {content.title}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-base max-w-md mx-auto">
                  {content.description}
                </p>
              </div>

              {/* Progress Indicator */}
              {content.showProgress && (
                <div className="mb-6">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full transition-all duration-500 ease-out animate-shimmer"
                      style={{ 
                        width: `${Math.max(syncProgress, 15)}%`,
                        backgroundSize: '200% 100%',
                      }} 
                    />
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {syncProgress < 30 ? "Connecting to QuickBooks..." : 
                       syncProgress < 60 ? "Fetching transactions..." : 
                       syncProgress < 90 ? "Processing data..." : "Almost done..."}
                    </p>
                    <p className="text-xs font-medium text-indigo-500 dark:text-indigo-400">
                      {Math.round(syncProgress)}%
                    </p>
                  </div>
                </div>
              )}

              {/* Retry Button for Failed/Needs Sync State (not during syncing) */}
              {(status === "failed" || status === "needs_sync") && !isRetrying && (
                <div className="flex flex-col items-center gap-3">
                  <Button
                    onClick={handleRetry}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2 px-6 py-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {status === "failed" ? "Retry Sync" : "Start Sync"}
                  </Button>
                  {retryError && (
                    <p className="text-sm text-red-500 dark:text-red-400">{retryError}</p>
                  )}
                </div>
              )}

              {/* Tips - Show during any syncing state */}
              {(status === "pending" || status === "in_progress" || isRetrying) && (
                <div className="mt-6 p-4 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                  <h4 className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-2">
                    💡 While you wait:
                  </h4>
                  <ul className="text-xs text-indigo-600 dark:text-indigo-400 space-y-1">
                    <li>• Initial sync fetches up to 2 years of data</li>
                    <li>• Daily syncs will keep everything up to date</li>
                    <li>• You can close this tab - sync continues in background</li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

