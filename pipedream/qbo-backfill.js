// =====================================================
// VIRGO-QBO BACKFILL (Updated with user_id + sync_status)
// =====================================================
// Trigger: HTTP Webhook (https://eo8tqs54xlmq3dx.m.pipedream.net)
// 
// This workflow pulls 24 months of historical P&L data
// =====================================================

import fetch from "node-fetch";

export default defineComponent({
  props: {
    quickbooks: { type: "app", app: "quickbooks" },
  },

  async run({ steps, $ }) {
    //------------------------------------------------
    // 0. ENV + AUTH
    //------------------------------------------------
    const SB_URL = process.env.SUPABASE_URL;
    const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SB_URL || !SB_KEY) throw new Error("Missing Supabase env vars");

    const accessToken = this.quickbooks.$auth.oauth_access_token;
    const realmId = this.quickbooks.$auth.company_id;
    if (!realmId) throw new Error("Missing QuickBooks realmId");

    const MONTHS_BACK = 24;
    console.log(`Starting backfill for ${MONTHS_BACK} months...`);

    const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

    //------------------------------------------------
    // Supabase REST helper
    //------------------------------------------------
    async function sb(table, method = "GET", body = null, query = "") {
      const res = await fetch(`${SB_URL}/rest/v1/${table}${query}`, {
        method,
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const txt = await res.text();
      if (!res.ok) throw new Error(`SUPABASE ERROR → ${txt}`);
      return txt ? JSON.parse(txt) : null;
    }

    //------------------------------------------------
    // QBO Report API helper
    //------------------------------------------------
    async function qboReport(reportName, params = {}) {
      const queryString = new URLSearchParams(params).toString();
      const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/reports/${reportName}?${queryString}`;
      
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`QBO Report API Error: ${errText}`);
      }

      return res.json();
    }

    //------------------------------------------------
    // QBO Query API helper (for transactions with metadata)
    //------------------------------------------------
    async function qboQuery(query) {
      const res = await fetch(
        `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        }
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }

    async function qboPaged(entity, whereClause = "") {
      const all = [];
      let start = 1;
      const pageSize = 1000;

      while (true) {
        const q = `SELECT * FROM ${entity} ${whereClause ? `WHERE ${whereClause}` : ""} STARTPOSITION ${start} MAXRESULTS ${pageSize}`;
        const data = await qboQuery(q);
        const rows = data?.QueryResponse?.[entity] || [];
        all.push(...rows);
        if (rows.length < pageSize) break;
        start += pageSize;
      }
      return all;
    }

    //------------------------------------------------
    // 1. Resolve company_id from qbo_connections
    //------------------------------------------------
    const [conn] = await sb(
      "qbo_connections",
      "GET",
      null,
      `?realm_id=eq.${realmId}&select=*`
    );
    if (!conn) throw new Error(`No qbo_connections row for realm_id=${realmId}`);
    const company_id = conn.company_id;

    console.log(`Company ID: ${company_id}`);
    console.log(`User ID: ${conn.user_id || 'not set'}`);

    //------------------------------------------------
    // 2. Update sync_status to in_progress
    //------------------------------------------------
    const [pendingSync] = await sb(
      "sync_status",
      "GET",
      null,
      `?connection_id=eq.${conn.id}&status=eq.pending&order=created_at.desc&limit=1`
    );

    if (pendingSync) {
      await sb(
        "sync_status",
        "PATCH",
        { status: "in_progress", started_at: new Date().toISOString() },
        `?id=eq.${pendingSync.id}`
      );
    }

    //------------------------------------------------
    // 3. Clear existing data for fresh backfill
    //------------------------------------------------
    await sb("raw_transactions", "DELETE", null, `?company_id=eq.${company_id}`);
    console.log("Cleared existing raw_transactions");

    //------------------------------------------------
    // 4. Sync Accounts (Chart of Accounts)
    //------------------------------------------------
    const qboAccounts = await qboPaged("Account");
    if (qboAccounts.length) {
      await sb(
        "accounts",
        "POST",
        qboAccounts.map((a) => ({
          company_id,
          qbo_account_id: a.Id,
          name: a.Name,
          type: a.AccountType || null,
          subtype: a.AccountSubType || null,
        })),
        "?on_conflict=company_id,qbo_account_id"
      );
    }
    console.log(`Synced ${qboAccounts.length} accounts`);

    const accounts = await sb(
      "accounts",
      "GET",
      null,
      `?company_id=eq.${company_id}&select=id,qbo_account_id,name,type`
    );
    const accountByName = {};
    for (const a of accounts) {
      accountByName[a.name.toLowerCase().trim()] = a;
    }

    //------------------------------------------------
    // 5. Fetch ALL transactions to build LastUpdated map
    //------------------------------------------------
    console.log("Fetching transaction metadata for LastUpdatedTime...");
    
    const txnTypes = [
      "Purchase", "SalesReceipt", "Invoice", "Payment", 
      "Bill", "BillPayment", "JournalEntry", "Deposit",
      "RefundReceipt", "CreditMemo", "VendorCredit"
    ];
    
    const lastUpdatedMap = new Map();
    
    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - MONTHS_BACK);
    const sinceDateStr = sinceDate.toISOString().split("T")[0];

    for (const txnType of txnTypes) {
      try {
        const txns = await qboPaged(txnType, `TxnDate >= '${sinceDateStr}'`);
        for (const txn of txns) {
          const lastUpdated = txn.MetaData?.LastUpdatedTime || null;
          const txnDate = txn.TxnDate;
          const totalAmt = txn.TotalAmt || 0;
          
          const key1 = `${txnType}-${txn.Id}`;
          const key2 = `${txnDate}-${Math.abs(totalAmt).toFixed(2)}`;
          
          if (lastUpdated) {
            lastUpdatedMap.set(key1, lastUpdated);
            lastUpdatedMap.set(key2, lastUpdated);
          }
          
          if (txn.Line) {
            for (const line of txn.Line) {
              const lineAmt = Math.abs(line.Amount || 0).toFixed(2);
              const lineKey = `${txnDate}-${lineAmt}`;
              if (lastUpdated && !lastUpdatedMap.has(lineKey)) {
                lastUpdatedMap.set(lineKey, lastUpdated);
              }
            }
          }
        }
        console.log(`Fetched ${txns.length} ${txnType} transactions`);
      } catch (e) {
        console.log(`Skipping ${txnType}: ${e.message}`);
      }
    }
    
    console.log(`Built LastUpdatedTime map with ${lastUpdatedMap.size} entries`);

    //------------------------------------------------
    // 6. Generate month ranges
    //------------------------------------------------
    function getMonthRanges(monthsBack) {
      const ranges = [];
      const now = new Date();
      
      for (let i = 0; i < monthsBack; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth();
        
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);
        
        ranges.push({
          start: startDate.toISOString().split("T")[0],
          end: endDate.toISOString().split("T")[0],
          monthKey: `${year}-${String(month + 1).padStart(2, "0")}-01`,
        });
      }
      return ranges;
    }

    const monthRanges = getMonthRanges(MONTHS_BACK);

    //------------------------------------------------
    // 7. Parse P&L Summary for accurate totals
    //------------------------------------------------
    function parsePLSummary(report) {
      let revenue = 0, cogs = 0, expenses = 0;

      function parseAmount(str) {
        if (!str) return 0;
        const cleaned = str.replace(/[,$]/g, "").replace(/\(([^)]+)\)/, "-$1");
        return parseFloat(cleaned) || 0;
      }

      function findTotals(rows) {
        for (const row of rows) {
          const summaryData = row.Summary?.ColData;
          const headerData = row.Header?.ColData;
          
          for (const colData of [summaryData, headerData]) {
            if (colData) {
              const label = (colData[0]?.value || "").toLowerCase();
              const amount = parseAmount(colData[1]?.value);

              if (label === "total income" || label === "total for income") {
                revenue = amount;
              }
              if (label === "total for cost of sales" || label === "total cost of sales") {
                cogs = amount;
              } else if ((label === "total for cost of goods sold" || label === "total cost of goods sold") && cogs === 0) {
                cogs = amount;
              }
              if (label === "total expenses" || label === "total for expenses") {
                expenses = amount;
              }
            }
          }

          if (row.Rows?.Row) findTotals(row.Rows.Row);
        }
      }

      findTotals(report?.Rows?.Row || []);
      return { revenue: round2(revenue), cogs: round2(cogs), expenses: round2(expenses) };
    }

    //------------------------------------------------
    // 8. Parse P&L Detail for transactions
    //------------------------------------------------
    function parsePLDetail(report, range, accountByName, company_id, lastUpdatedMap) {
      const transactions = [];
      let lineIndex = 0;
      const seenKeys = new Set();

      function parseRows(rows, currentSection = null, parentAccount = null) {
        for (const row of rows) {
          if (row.Header?.ColData) {
            const headerLabel = row.Header.ColData[0]?.value || "";
            const headerLower = headerLabel.toLowerCase();
            
            if (headerLower.includes("income") && !headerLower.includes("net") && !headerLower.includes("total")) {
              currentSection = "income";
            } else if (headerLower.includes("cost of sales") || headerLower.includes("cost of goods")) {
              currentSection = "cogs";
            } else if (headerLower.includes("expense") && !headerLower.includes("net") && !headerLower.includes("total")) {
              currentSection = "expense";
            }
            
            if (!headerLower.includes("total") && !headerLower.includes("income") && 
                !headerLower.includes("expense") && !headerLower.includes("cost of") &&
                !headerLower.includes("gross profit") && !headerLower.includes("net")) {
              parentAccount = headerLabel;
            }
          }

          if (row.ColData && row.type === "Data") {
            const cols = row.ColData;
            const date = cols[0]?.value;
            const txnType = cols[1]?.value || "";
            const num = cols[2]?.value || "";
            const name = cols[3]?.value || "";
            const memo = cols[4]?.value || "";
            const split = cols[5]?.value || "";
            const amountStr = cols[6]?.value || cols[cols.length - 2]?.value || "0";

            if (!date || date.toLowerCase().includes("total")) continue;
            if (txnType.toLowerCase().includes("total")) continue;

            const amount = parseFloat(amountStr.replace(/[,$()]/g, (m) => m === "(" || m === ")" ? "-" : "")) || 0;
            if (!amount || !currentSection) continue;

            const accountSearchName = (parentAccount || split || name || "").toLowerCase().trim();
            const account = accountByName[accountSearchName];

            const uniqueKey = `${date}-${txnType}-${num}-${Math.abs(amount).toFixed(2)}-${accountSearchName}`;
            if (seenKeys.has(uniqueKey)) continue;
            seenKeys.add(uniqueKey);

            lineIndex++;
            const txnId = `RPT-${range.monthKey}-${lineIndex}`;

            const amtKey = `${date}-${Math.abs(amount).toFixed(2)}`;
            const qboLastUpdated = lastUpdatedMap.get(amtKey) || null;

            const description = [memo, name, split, parentAccount]
              .filter(Boolean)
              .join(" | ")
              .substring(0, 500) || "From P&L Report";

            transactions.push({
              company_id,
              txn_id: txnId,
              date,
              amount: round2(Math.abs(amount)),
              source: `PnL-${txnType || "Transaction"}`,
              description,
              account_id: account?.id || null,
              qbo_last_updated: qboLastUpdated,
            });
          }

          if (row.Rows?.Row) {
            parseRows(row.Rows.Row, currentSection, parentAccount);
          }
        }
      }

      parseRows(report?.Rows?.Row || []);
      return transactions;
    }

    //------------------------------------------------
    // 9. Process each month
    //------------------------------------------------
    const monthlySummaries = [];
    let totalTransactions = 0;

    for (const range of monthRanges) {
      console.log(`Processing ${range.monthKey}...`);

      let summaryReport;
      try {
        summaryReport = await qboReport("ProfitAndLoss", {
          start_date: range.start,
          end_date: range.end,
          accounting_method: "Cash",
        });
      } catch (e) {
        console.log(`Skipping ${range.monthKey} summary: ${e.message}`);
        continue;
      }

      const { revenue, cogs, expenses } = parsePLSummary(summaryReport);
      const netProfit = round2(revenue - cogs - expenses);

      monthlySummaries.push({
        month: range.monthKey,
        revenue, cogs, expenses, net_profit: netProfit,
      });

      let detailReport;
      try {
        detailReport = await qboReport("ProfitAndLossDetail", {
          start_date: range.start,
          end_date: range.end,
          accounting_method: "Cash",
        });
      } catch (e) {
        console.log(`Skipping ${range.monthKey} detail: ${e.message}`);
        continue;
      }

      const transactions = parsePLDetail(detailReport, range, accountByName, company_id, lastUpdatedMap);
      
      if (transactions.length) {
        for (let i = 0; i < transactions.length; i += 500) {
          const chunk = transactions.slice(i, i + 500);
          await sb("raw_transactions", "POST", chunk);
        }
        totalTransactions += transactions.length;
      }

      console.log(`${range.monthKey}: Rev=${revenue}, COGS=${cogs}, Exp=${expenses}, Txns=${transactions.length}`);
    }

    //------------------------------------------------
    // 10. Upsert monthly_pl data
    //------------------------------------------------
    if (monthlySummaries.length > 0) {
      const plRecords = monthlySummaries.map(m => ({
        company_id,
        month: m.month,
        revenue: m.revenue,
        cogs: m.cogs,
        expenses: m.expenses,
        net_profit: m.net_profit,
        updated_at: new Date().toISOString(),
      }));

      await sb("monthly_pl", "POST", plRecords, "?on_conflict=company_id,month");
      console.log(`Upserted ${plRecords.length} monthly_pl records`);
    }

    //------------------------------------------------
    // 11. Update sync status and last_sync_at
    //------------------------------------------------
    if (pendingSync) {
      await sb(
        "sync_status",
        "PATCH",
        { 
          status: "completed", 
          completed_at: new Date().toISOString(),
          records_synced: totalTransactions,
        },
        `?id=eq.${pendingSync.id}`
      );
    }

    await sb(
      "qbo_connections",
      "PATCH",
      { last_sync_at: new Date().toISOString() },
      `?id=eq.${conn.id}`
    );

    return {
      status: "✅ Backfill Complete",
      company_id,
      user_id: conn.user_id,
      months_processed: monthlySummaries.length,
      total_transactions: totalTransactions,
      sample_months: monthlySummaries.slice(0, 3),
    };
  },
});

