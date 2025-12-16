"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, ArrowRight, Sparkles, TrendingUp, PieChart, DollarSign } from "lucide-react";

export function EmptyDashboardState() {
  const router = useRouter();

  const handleConnectQBO = () => {
    router.push("/data-sources");
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50 dark:bg-[#1a1f2e] transition-colors duration-300">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          {/* Main Card */}
          <Card className="bg-white dark:bg-gray-800/50 border-gray-200 dark:border-white/10 shadow-lg">
            <CardContent className="p-8 sm:p-12">
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <Database className="w-10 h-10 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-md animate-pulse">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>

              {/* Title & Description */}
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
                  Connect Your QuickBooks
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg max-w-md mx-auto">
                  Link your QuickBooks Online account to unlock powerful financial insights and real-time analytics.
                </p>
              </div>

              {/* Feature List */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="flex flex-col items-center p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center mb-3">
                    <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
                    Revenue Tracking
                  </p>
                </div>
                <div className="flex flex-col items-center p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-500/20 flex items-center justify-center mb-3">
                    <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
                    Profit Analysis
                  </p>
                </div>
                <div className="flex flex-col items-center p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center mb-3">
                    <PieChart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
                    Smart Projections
                  </p>
                </div>
              </div>

              {/* CTA Button */}
              <div className="flex justify-center">
                <Button
                  onClick={handleConnectQBO}
                  size="lg"
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 gap-2"
                >
                  Connect QuickBooks
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>

              {/* Security Note */}
              <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
                🔒 Your data is encrypted and secure. We never store your QuickBooks credentials.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

