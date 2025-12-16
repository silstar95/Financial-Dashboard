/**
 * VIRGO - QBO Auto Backfill (Triggered by Dashboard OAuth)
 * 
 * This workflow is triggered automatically when a user connects QBO
 * through the dashboard. It receives the OAuth tokens directly from
 * the webhook and uses them to fetch data.
 * 
 * TRIGGER: HTTP Webhook (receives POST from dashboard OAuth callback)
 * 
 * Webhook payload from dashboard:
 * {
 *   realm_id: string,
 *   company_id: string,
 *   connection_id: string,
 *   user_id: string,
 *   action: "backfill" | "incremental_sync" | "manual_sync",
 *   access_token: string,
 *   refresh_token: string
 * }
 */

export default defineComponent({
  props: {
    supabaseUrl: {
      type: "string",
      label: "Supabase URL",
      description: "Your Supabase project URL",
    },
    supabaseServiceKey: {
      type: "string",
      label: "Supabase Service Role Key",
      description: "Service role key for full database access",
      secret: true,
    },
  },

  async run({ steps }) {
    // =========================================
    // 1. EXTRACT DATA FROM WEBHOOK
    // =========================================
    const payload = steps.trigger.event.body;
    
    const {
      realm_id,
      company_id,
      connection_id,
      user_id,
      action,
      access_token,
      refresh_token,
    } = payload;

    console.log("=== QBO Auto Backfill Started ===");
    console.log("Realm ID:", realm_id);
    console.log("Company ID:", company_id);
    console.log("User ID:", user_id);
    console.log("Action:", action);

    if (!access_token || !realm_id || !company_id) {
      throw new Error("Missing required fields: access_token, realm_id, or company_id");
    }

    // =========================================
    // 2. HELPER: Supabase API
    // =========================================
    const supabase = async (table, method, body, query = "") => {
      const url = `${this.supabaseUrl}/rest/v1/${table}${query}`;
      const options = {
        method,
        headers: {
          apikey: this.supabaseServiceKey,
          Authorization: `Bearer ${this.supabaseServiceKey}`,
          "Content-Type": "application/json",
          Prefer: method === "POST" ? "return=representation" : "return=minimal",
        },
      };
      if (body) options.body = JSON.stringify(body);
      
      const res = await fetch(url, options);
      if (!res.ok) {
        const text = await res.text();
        console.error(`Supabase ${method} ${table} failed:`, text);
        throw new Error(`Supabase error: ${text}`);
      }
      
      if (method === "GET" || (method === "POST" && options.headers.Prefer.includes("return"))) {
        return res.json();
      }
      return null;
    };

    // =========================================
    // 3. HELPER: QuickBooks API (uses tokens from webhook)
    // =========================================
    const qboRequest = async (endpoint, minorVersion = 65) => {
      const url = `https://quickbooks.api.intuit.com/v3/company/${realm_id}/${endpoint}`;
      const separator = url.includes("?") ? "&" : "?";
      const fullUrl = `${url}${separator}minorversion=${minorVersion}`;
      
      console.log("QBO Request:", fullUrl);
      
      const res = await fetch(fullUrl, {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("QBO API Error:", res.status, text);
        throw new Error(`QBO API error ${res.status}: ${text}`);
      }

      return res.json();
    };

    // =========================================
    // 4. UPDATE SYNC STATUS: IN PROGRESS
    // =========================================
    try {
      await supabase("sync_status", "PATCH", {
        status: "in_progress",
        started_at: new Date().toISOString(),
        error_message: null,
      }, `?company_id=eq.${company_id}&status=eq.pending&order=created_at.desc&limit=1`);
      console.log("Sync status updated to: in_progress");
    } catch (e) {
      console.warn("Could not update sync_status:", e.message);
    }

    // =========================================
    // 5. FETCH PROFIT & LOSS DATA
    // =========================================
    const results = {
      monthsProcessed: 0,
      errors: [],
    };

    try {
      // Get current date and calculate date ranges
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // Backfill last 4 years
      const startYear = currentYear - 4;

      console.log(`Fetching P&L from ${startYear}-01 to ${currentYear}-${currentMonth}`);

      const monthlyData = [];

      for (let year = startYear; year <= currentYear; year++) {
        const endMonth = year === currentYear ? currentMonth : 12;
        
        for (let month = 1; month <= endMonth; month++) {
          // Calculate start and end dates for the month
          const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
          const lastDay = new Date(year, month, 0).getDate();
          const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

          try {
            console.log(`Fetching P&L for ${year}-${String(month).padStart(2, "0")}`);
            
            const plReport = await qboRequest(
              `reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}&accounting_method=Accrual`
            );

            // Parse the P&L report
            const parsed = parseProfitAndLoss(plReport);
            
            monthlyData.push({
              company_id: company_id,
              month: `${year}-${String(month).padStart(2, "0")}-01`,
              revenue: parsed.totalIncome || 0,
              cogs: parsed.costOfGoodsSold || 0,
              expenses: parsed.totalExpenses || 0,  // Fixed: was "operating_expenses"
              net_profit: parsed.netIncome || 0,
              updated_at: new Date().toISOString(),
            });

            results.monthsProcessed++;
            
            // Rate limiting - QBO allows ~500 requests/minute
            await new Promise(r => setTimeout(r, 200));
            
          } catch (err) {
            console.error(`Error fetching ${year}-${month}:`, err.message);
            results.errors.push(`${year}-${month}: ${err.message}`);
          }
        }
      }

      // =========================================
      // 6. UPSERT DATA TO SUPABASE
      // =========================================
      if (monthlyData.length > 0) {
        console.log(`Upserting ${monthlyData.length} months of data...`);
        
        // Upsert in batches of 50
        for (let i = 0; i < monthlyData.length; i += 50) {
          const batch = monthlyData.slice(i, i + 50);
          await supabase("monthly_pl", "POST", batch, "?on_conflict=company_id,month");
          console.log(`Upserted batch ${Math.floor(i / 50) + 1}`);
        }
      }

      // =========================================
      // 7. UPDATE SYNC STATUS: COMPLETED
      // =========================================
      await supabase("sync_status", "PATCH", {
        status: "completed",
        completed_at: new Date().toISOString(),
        records_synced: results.monthsProcessed,
        error_message: results.errors.length > 0 ? results.errors.join("; ") : null,
      }, `?company_id=eq.${company_id}&status=eq.in_progress&order=created_at.desc&limit=1`);

      // Update last_sync_at on qbo_connections
      await supabase("qbo_connections", "PATCH", {
        last_sync_at: new Date().toISOString(),
      }, `?id=eq.${connection_id}`);

      console.log("=== Backfill Completed ===");
      console.log("Months processed:", results.monthsProcessed);
      console.log("Errors:", results.errors.length);

      return {
        success: true,
        monthsProcessed: results.monthsProcessed,
        errors: results.errors,
      };

    } catch (error) {
      console.error("Backfill failed:", error);

      // Update sync status to failed
      try {
        await supabase("sync_status", "PATCH", {
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: error.message,
        }, `?company_id=eq.${company_id}&status=eq.in_progress&order=created_at.desc&limit=1`);
      } catch (e) {
        console.error("Could not update sync_status to failed:", e);
      }

      throw error;
    }
  },
});

// =========================================
// HELPER: Parse QuickBooks P&L Report
// =========================================
function parseProfitAndLoss(report) {
  const result = {
    totalIncome: 0,
    costOfGoodsSold: 0,
    grossProfit: 0,
    totalExpenses: 0,
    netIncome: 0,
  };

  if (!report || !report.Rows || !report.Rows.Row) {
    return result;
  }

  const rows = report.Rows.Row;

  for (const row of rows) {
    if (!row.group) continue;

    const groupName = row.group.toLowerCase();
    const summary = row.Summary;
    
    if (!summary || !summary.ColData) continue;
    
    // Get the value (usually in the second column)
    const valueCol = summary.ColData.find(col => col.value && !isNaN(parseFloat(col.value)));
    const value = valueCol ? parseFloat(valueCol.value) : 0;

    if (groupName.includes("income") && !groupName.includes("net")) {
      result.totalIncome = value;
    } else if (groupName.includes("cost") && groupName.includes("goods")) {
      result.costOfGoodsSold = value;
    } else if (groupName.includes("gross")) {
      result.grossProfit = value;
    } else if (groupName.includes("expense")) {
      result.totalExpenses = value;
    } else if (groupName.includes("net")) {
      result.netIncome = value;
    }
  }

  // Calculate gross profit if not provided
  if (result.grossProfit === 0 && result.totalIncome > 0) {
    result.grossProfit = result.totalIncome - result.costOfGoodsSold;
  }

  return result;
}

