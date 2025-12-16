"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type SyncStatusType = "pending" | "in_progress" | "completed" | "failed" | null;

interface SyncStatus {
  id: string;
  company_id: string;
  sync_type: string;
  status: SyncStatusType;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export function useSyncStatus(companyId: string | null) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);

  const checkForData = useCallback(async (cId: string) => {
    try {
      const supabase = createClient();
      
      // Check if there's any data in monthly_pl for this company
      const { count, error: countError } = await supabase
        .from("monthly_pl")
        .select("*", { count: "exact", head: true })
        .eq("company_id", cId);

      if (countError) {
        console.error("Error checking for data:", countError);
        return false;
      }

      return (count || 0) > 0;
    } catch (err) {
      console.error("Error in checkForData:", err);
      return false;
    }
  }, []);

  const fetchSyncStatus = useCallback(async () => {
    console.log("🔄 [useSyncStatus] Checking sync status...");
    console.log("🔄 [useSyncStatus] Company ID:", companyId || "None");
    
    if (!companyId) {
      console.log("🔄 [useSyncStatus] No company ID - skipping");
      setStatus(null);
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();

      // Get the latest sync status for this company
      const { data, error: fetchError } = await supabase
        .from("sync_status")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("🔄 [useSyncStatus] Error fetching:", fetchError);
        setError(fetchError.message);
      } else {
        console.log("🔄 [useSyncStatus] Sync status:", data?.status || "None");
        setStatus(data || null);
      }

      // Also check if there's any data
      const dataExists = await checkForData(companyId);
      console.log("🔄 [useSyncStatus] Has monthly_pl data:", dataExists);
      setHasData(dataExists);

    } catch (err) {
      console.error("🔄 [useSyncStatus] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch sync status");
    } finally {
      setLoading(false);
    }
  }, [companyId, checkForData]);

  useEffect(() => {
    fetchSyncStatus();
    
    // Poll every 5 seconds while syncing
    const interval = setInterval(() => {
      if (status?.status === "pending" || status?.status === "in_progress") {
        fetchSyncStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [companyId, fetchSyncStatus, status?.status]);

  const isSyncing = status?.status === "pending" || status?.status === "in_progress";
  const syncFailed = status?.status === "failed";
  const syncComplete = status?.status === "completed";
  const needsSync = !hasData && !isSyncing && !syncComplete;

  return {
    status,
    loading,
    error,
    hasData,
    isSyncing,
    syncFailed,
    syncComplete,
    needsSync,
    refetch: fetchSyncStatus,
  };
}

