"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { HubAssistant } from "@/components/layout/HubAssistant";
import { Header } from "@/components/layout/Header";
import { DashboardGrid } from "@/components/layout/DashboardGrid";
import { EmptyDashboardState } from "@/components/widgets/EmptyDashboardState";
import { SyncingState } from "@/components/widgets/SyncingState";
import { useQBOConnection } from "@/hooks/useQBOConnection";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { Menu, X, MessageSquare, Loader2 } from "lucide-react";

export default function DashboardPage() {
  const { connection, isConnected, companyId, loading } = useQBOConnection();
  const { hasData, isSyncing, syncFailed, needsSync, status, refetch } = useSyncStatus(companyId);
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  // Dashboard status logging
  console.log("🏠 [Dashboard] =================================");
  console.log("🏠 [Dashboard] Loading:", loading);
  console.log("🏠 [Dashboard] QBO Connected:", isConnected);
  console.log("🏠 [Dashboard] Company ID:", companyId || "None");
  console.log("🏠 [Dashboard] Company Name:", connection?.company_name || "Unknown");
  console.log("🏠 [Dashboard] Has Data:", hasData);
  console.log("🏠 [Dashboard] Is Syncing:", isSyncing);
  console.log("🏠 [Dashboard] Sync Failed:", syncFailed);
  console.log("🏠 [Dashboard] Needs Sync:", needsSync);
  console.log("🏠 [Dashboard] Sync Status:", status?.status || "None");
  console.log("🏠 [Dashboard] =================================");

  return (
    <div className="flex h-screen w-full bg-gray-50 dark:bg-[#1a1f2e] transition-colors duration-300 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Mobile Assistant Overlay */}
      {assistantOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setAssistantOpen(false)}
        />
      )}

      {/* Sidebar - Hidden on mobile, slide-in drawer */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-50
        w-[280px] lg:w-[15%] h-full shrink-0 
        border-r border-gray-200 dark:border-white/10
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar />
        {/* Close button on mobile */}
        <button 
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 lg:hidden"
        >
          <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {/* Hub Assistant - Hidden on mobile/tablet, slide-in drawer */}
      <div className={`
        fixed lg:relative inset-y-0 right-0 z-50
        w-[320px] lg:w-[25%] h-full shrink-0 
        border-l lg:border-l-0 lg:border-r border-gray-200 dark:border-white/10
        bg-white dark:bg-[#1a1f2e]
        transform transition-transform duration-300 ease-in-out
        ${assistantOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        <HubAssistant onClose={() => setAssistantOpen(false)} showCloseButton={true} />
      </div>

      {/* Main Content - Full width on mobile, 60% on desktop */}
      <div className="flex-1 lg:w-[60%] h-full flex flex-col bg-gray-50 dark:bg-[#1a1f2e]">
        {/* Mobile Header with menu buttons */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Menu className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Finance Hub</h1>
          <button 
            onClick={() => setAssistantOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <MessageSquare className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
        
        {/* Desktop Header */}
        <div className="hidden lg:block">
          <Header title="Finance Hub" />
        </div>
        
        {/* Content Area - Show loading, empty state, syncing, or dashboard */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-gray-500 dark:text-gray-400">Loading your data...</p>
            </div>
          </div>
        ) : !isConnected ? (
          // Not connected - show empty state
          <EmptyDashboardState />
        ) : isSyncing ? (
          // Connected but syncing in progress
          <SyncingState 
            status={status?.status === "pending" ? "pending" : "in_progress"} 
            companyName={connection?.company_name}
          />
        ) : syncFailed ? (
          // Sync failed - show error state with retry
          <SyncingState 
            status="failed" 
            errorMessage={status?.error_message}
            companyName={connection?.company_name}
            onRetry={refetch}
          />
        ) : !hasData && needsSync ? (
          // Connected but no data and no sync in progress
          <SyncingState 
            status="needs_sync" 
            companyName={connection?.company_name}
            onRetry={refetch}
          />
        ) : companyId ? (
          // Has data - show dashboard
          <DashboardGrid companyId={companyId} />
        ) : (
          <EmptyDashboardState />
        )}
      </div>
    </div>
  );
}
