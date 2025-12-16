"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Database,
  Link2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  Trash2,
  Menu,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface QBOConnection {
  id: string;
  company_id: string;
  realm_id: string;
  qbo_company_id: string;
  expires_at: string;
  last_sync_at: string | null;
  created_at: string;
  company?: {
    name: string;
  };
}

export default function DataSourcesPage() {
  const [connections, setConnections] = useState<QBOConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for success/error messages in URL
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "connected") {
      setMessage({ type: "success", text: "QuickBooks connected successfully!" });
      // Clear URL params
      router.replace("/data-sources");
    } else if (error) {
      const errorMessages: Record<string, string> = {
        not_configured: "QuickBooks integration is not configured. Please contact support.",
        oauth_init_failed: "Failed to start QuickBooks connection. Please try again.",
        missing_params: "Invalid response from QuickBooks. Please try again.",
        invalid_state: "Security validation failed. Please try again.",
        token_exchange_failed: "Failed to complete QuickBooks connection. Please try again.",
        connection_creation_failed: "Failed to save connection. Please try again.",
        connection_update_failed: "Failed to update connection. Please try again.",
        not_authenticated: "Please log in to connect QuickBooks.",
      };
      setMessage({ 
        type: "error", 
        text: errorMessages[error] || `Connection failed: ${error}` 
      });
      // Clear URL params
      router.replace("/data-sources");
    }
  }, [searchParams, router]);

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("qbo_connections")
        .select(`
          id,
          company_id,
          realm_id,
          qbo_company_id,
          expires_at,
          last_sync_at,
          created_at,
          company:companies(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Transform the data to flatten company name
      const transformedData = (data || []).map((conn: any) => ({
        ...conn,
        company: conn.company?.[0] || conn.company
      }));
      
      setConnections(transformedData);
    } catch (err) {
      console.error("Error fetching connections:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectQBO = async () => {
    setConnecting(true);
    try {
      // Redirect to QBO OAuth initiation endpoint
      window.location.href = "/api/qbo/connect";
    } catch (err) {
      console.error("Error initiating QBO connection:", err);
      setConnecting(false);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm("Are you sure you want to disconnect this QuickBooks account?")) {
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("qbo_connections")
        .delete()
        .eq("id", connectionId);

      if (error) throw error;
      
      // Refresh the list
      fetchConnections();
    } catch (err) {
      console.error("Error disconnecting:", err);
    }
  };

  const handleSync = async (connectionId: string) => {
    // TODO: Implement sync functionality
    console.log("Syncing connection:", connectionId);
    alert("Sync functionality coming soon!");
  };

  const isTokenExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="flex h-screen w-full bg-gray-50 dark:bg-[#1a1f2e] transition-colors duration-300 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-50
        w-[280px] lg:w-[15%] h-full shrink-0 
        border-r border-gray-200 dark:border-white/10
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 h-full flex flex-col bg-gray-50 dark:bg-[#1a1f2e]">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Menu className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Data Sources</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Desktop Header */}
        <div className="hidden lg:block">
          <Header title="Data Sources" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Success/Error Messages */}
            {message && (
              <div
                className={`flex items-center gap-3 p-4 rounded-lg ${
                  message.type === "success"
                    ? "bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20"
                    : "bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20"
                }`}
              >
                {message.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                )}
                <p className={`text-sm ${
                  message.type === "success" 
                    ? "text-green-700 dark:text-green-400" 
                    : "text-red-700 dark:text-red-400"
                }`}>
                  {message.text}
                </p>
                <button
                  onClick={() => setMessage(null)}
                  className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Page Description */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Connect Your Data
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                Connect your accounting software to sync financial data automatically.
              </p>
            </div>

            {/* QuickBooks Integration Card */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2ca01c] via-[#108a00] to-[#0d6b00] p-[1px]">
              <div className="relative rounded-2xl bg-gradient-to-br from-[#2ca01c]/95 via-[#108a00]/95 to-[#0d6b00]/95 backdrop-blur-xl overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
                
                <div className="relative p-8 sm:p-10">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                    {/* Logo & Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-black/20">
                          <svg viewBox="0 0 40 40" className="w-10 h-10">
                            <circle cx="20" cy="20" r="18" fill="#2CA01C"/>
                            <path d="M12 20c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round"/>
                            <circle cx="20" cy="20" r="3" fill="white"/>
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-white">
                            QuickBooks Online
                          </h3>
                          <p className="text-green-100/80 text-sm font-medium">
                            Accounting & Financial Management
                          </p>
                        </div>
                      </div>
                      
                      <p className="text-green-50/90 text-base mb-6 max-w-lg">
                        Connect your QuickBooks account to automatically sync your financial data and unlock powerful insights for your business.
                      </p>
                      
                      {/* Features */}
                      <div className="grid grid-cols-2 gap-3 mb-8">
                        {[
                          "Income & Expenses",
                          "Invoices & Payments",
                          "Profit & Loss Reports",
                          "Real-time Sync"
                        ].map((feature) => (
                          <div key={feature} className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-200" />
                            <span className="text-sm text-green-50/90">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Connect Button */}
                    <div className="sm:self-center">
                      <Button
                        onClick={handleConnectQBO}
                        disabled={connecting}
                        size="lg"
                        className="w-full sm:w-auto bg-white hover:bg-green-50 text-[#2ca01c] font-semibold px-8 py-6 text-base rounded-xl shadow-lg shadow-black/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        {connecting ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Link2 className="w-5 h-5 mr-2" />
                            Connect QuickBooks
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Connected Accounts */}
            <Card className="bg-white dark:bg-gray-800/50 border-gray-200 dark:border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    Connected Accounts
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchConnections}
                    disabled={loading}
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : connections.length === 0 ? (
                  <div className="text-center py-8">
                    <Database className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                      No accounts connected yet
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                      Connect QuickBooks above to get started
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {connections.map((conn) => (
                      <div
                        key={conn.id}
                        className="flex items-center justify-between p-4 border border-gray-200 dark:border-white/10 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">QB</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-gray-900 dark:text-white">
                                {conn.company?.name || `Company ${conn.qbo_company_id}`}
                              </h4>
                              {isTokenExpired(conn.expires_at) ? (
                                <span className="flex items-center gap-1 text-xs text-red-500">
                                  <XCircle className="w-3 h-3" />
                                  Expired
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-green-500">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Connected
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Realm ID: {conn.realm_id}
                              {conn.last_sync_at && (
                                <span className="ml-2">
                                  • Last sync: {new Date(conn.last_sync_at).toLocaleDateString()}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSync(conn.id)}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDisconnect(conn.id)}
                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

