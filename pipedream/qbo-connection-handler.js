// =====================================================
// VIRGO-QBO CONNECTIONS HANDLER (Updated with user_id)
// =====================================================
// Trigger: HTTP Webhook (https://eouov5rh8k6xagh.m.pipedream.net)
// 
// This workflow handles QBO connections from either:
// 1. Pipedream's built-in QuickBooks OAuth
// 2. Webhook call from Next.js app (with user_id)
// =====================================================

import fetch from "node-fetch";

export default defineComponent({
  props: {
    quickbooks: {
      type: "app",
      app: "quickbooks",
    },
  },

  async run({ steps, $ }) {
    // ----------------------------------------------------
    // 0. ENV SETUP
    // ----------------------------------------------------
    const sbUrl = process.env.SUPABASE_URL;
    const sbServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!sbUrl || !sbServiceKey) {
      throw new Error("Missing Supabase environment variables.");
    }

    // Check for webhook payload (from Next.js app)
    const webhookPayload = steps.trigger?.event?.body || {};
    const userIdFromWebhook = webhookPayload.user_id || null;
    const actionFromWebhook = webhookPayload.action || null;

    // ----------------------------------------------------
    // 1. CHECK IF QUICKBOOKS IS CONNECTED
    // ----------------------------------------------------
    if (!this.quickbooks || !this.quickbooks.$auth) {
      // If called via webhook with existing connection info, that's OK
      if (actionFromWebhook === "backfill" && webhookPayload.realm_id) {
        return {
          success: true,
          status: "webhook_trigger",
          message: "Backfill triggered via webhook. Run the backfill workflow.",
          realm_id: webhookPayload.realm_id,
          company_id: webhookPayload.company_id,
          user_id: userIdFromWebhook,
        };
      }
      
      return {
        success: false,
        status: "waiting_for_connection",
        message: "No QuickBooks account connected yet. Please click 'Connect account' on the QuickBooks step above.",
      };
    }

    const access_token = this.quickbooks.$auth.oauth_access_token;
    const refresh_token = this.quickbooks.$auth.oauth_refresh_token;
    const realmId = this.quickbooks.$auth.company_id;
    const expires_in = this.quickbooks.$auth.oauth_expires_in || 3600;

    if (!realmId || !access_token) {
      return {
        success: false,
        status: "incomplete_connection",
        message: "QuickBooks connection incomplete. Please reconnect the QuickBooks account.",
      };
    }

    // ----------------------------------------------------
    // 2. FETCH COMPANY NAME FROM QUICKBOOKS
    // ----------------------------------------------------
    const qboCompanyUrl = `https://quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}`;
    
    const qboResponse = await fetch(qboCompanyUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
      },
    });

    let companyName = `Company ${realmId}`;

    if (qboResponse.ok) {
      const qboData = await qboResponse.json();
      if (qboData?.CompanyInfo?.CompanyName) {
        companyName = qboData.CompanyInfo.CompanyName;
      }
    }

    console.log(`QuickBooks Company Name: ${companyName}`);
    console.log(`QuickBooks Realm ID: ${realmId}`);

    // ----------------------------------------------------
    // 3. CHECK IF COMPANY ALREADY EXISTS (BY REALM_ID)
    // ----------------------------------------------------
    const checkCompanyUrl = `${sbUrl}/rest/v1/companies?realm_id=eq.${realmId}&select=id,name,user_id`;
    
    const checkCompany = await fetch(checkCompanyUrl, {
      method: "GET",
      headers: {
        apikey: sbServiceKey,
        Authorization: `Bearer ${sbServiceKey}`,
      },
    });

    const existingCompanies = await checkCompany.json();
    let company_id = null;
    let isNewCompany = false;
    let existingUserId = null;

    if (existingCompanies && existingCompanies.length > 0) {
      company_id = existingCompanies[0].id;
      existingUserId = existingCompanies[0].user_id;
      console.log(`Found existing company: ${existingCompanies[0].name} (${company_id})`);
      
      // If we have a user_id from webhook and company doesn't have one, update it
      if (userIdFromWebhook && !existingUserId) {
        await fetch(`${sbUrl}/rest/v1/companies?id=eq.${company_id}`, {
          method: "PATCH",
          headers: {
            apikey: sbServiceKey,
            Authorization: `Bearer ${sbServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_id: userIdFromWebhook }),
        });
        console.log(`Updated company with user_id: ${userIdFromWebhook}`);
      }
    } else {
      company_id = crypto.randomUUID();
      isNewCompany = true;
      
      const createCompanyUrl = `${sbUrl}/rest/v1/companies`;
      
      const createResult = await fetch(createCompanyUrl, {
        method: "POST",
        headers: {
          apikey: sbServiceKey,
          Authorization: `Bearer ${sbServiceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          id: company_id,
          name: companyName,
          realm_id: realmId,
          user_id: userIdFromWebhook, // Include user_id if provided
          created_at: new Date().toISOString(),
        }),
      });

      if (!createResult.ok) {
        const errorText = await createResult.text();
        throw new Error(`Failed to create company: ${errorText}`);
      }

      console.log(`Created new company: ${companyName} (${company_id})`);
    }

    // ----------------------------------------------------
    // 4. CHECK IF QBO CONNECTION EXISTS
    // ----------------------------------------------------
    const checkConnectionUrl = `${sbUrl}/rest/v1/qbo_connections?realm_id=eq.${realmId}&select=id,user_id`;
    
    const checkConnection = await fetch(checkConnectionUrl, {
      method: "GET",
      headers: {
        apikey: sbServiceKey,
        Authorization: `Bearer ${sbServiceKey}`,
      },
    });

    const existingConnections = await checkConnection.json();
    let connection_id = null;

    if (existingConnections && existingConnections.length > 0) {
      connection_id = existingConnections[0].id;
      
      // Update user_id if provided and missing
      if (userIdFromWebhook && !existingConnections[0].user_id) {
        await fetch(`${sbUrl}/rest/v1/qbo_connections?id=eq.${connection_id}`, {
          method: "PATCH",
          headers: {
            apikey: sbServiceKey,
            Authorization: `Bearer ${sbServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_id: userIdFromWebhook }),
        });
      }
    } else {
      connection_id = crypto.randomUUID();
    }

    // ----------------------------------------------------
    // 5. UPSERT QBO CONNECTION
    // ----------------------------------------------------
    const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

    const connectionPayload = {
      id: connection_id,
      company_id: company_id,
      realm_id: realmId,
      qbo_company_id: realmId,
      access_token: access_token,
      refresh_token: refresh_token,
      expires_at: expires_at,
      user_id: userIdFromWebhook || existingUserId, // Preserve or add user_id
      updated_at: new Date().toISOString(),
    };

    const upsertUrl = `${sbUrl}/rest/v1/qbo_connections?on_conflict=realm_id`;
    
    const upsertResult = await fetch(upsertUrl, {
      method: "POST",
      headers: {
        apikey: sbServiceKey,
        Authorization: `Bearer ${sbServiceKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(connectionPayload),
    });

    if (!upsertResult.ok) {
      const errorText = await upsertResult.text();
      throw new Error(`Failed to save connection: ${errorText}`);
    }

    console.log("QuickBooks connection saved successfully!");

    // ----------------------------------------------------
    // 6. CREATE SYNC STATUS RECORD
    // ----------------------------------------------------
    if (isNewCompany) {
      await fetch(`${sbUrl}/rest/v1/sync_status`, {
        method: "POST",
        headers: {
          apikey: sbServiceKey,
          Authorization: `Bearer ${sbServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connection_id: connection_id,
          company_id: company_id,
          sync_type: "initial",
          status: "pending",
          created_at: new Date().toISOString(),
        }),
      });
      console.log("Created pending sync_status record");
    }

    // ----------------------------------------------------
    // 7. SUCCESS
    // ----------------------------------------------------
    return {
      success: true,
      status: "connected",
      company_id: company_id,
      company_name: companyName,
      realm_id: realmId,
      user_id: userIdFromWebhook || existingUserId,
      is_new_company: isNewCompany,
      message: `QuickBooks connected successfully for ${companyName}`,
      next_step: isNewCompany 
        ? "Run the VIRGO-QBO BACKFILL workflow to pull historical data."
        : "Connection updated. Run daily sync to refresh data.",
    };
  },
});

