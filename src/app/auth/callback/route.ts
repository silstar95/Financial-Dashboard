import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// QuickBooks OAuth Configuration
const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID || "";
const QBO_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET || "";
const QBO_REDIRECT_URI = process.env.NODE_ENV === "production"
  ? "https://quickbooks-project.vercel.app/auth/callback"
  : "http://localhost:3000/auth/callback";
const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

// Pipedream Webhook URLs
const PIPEDREAM_BACKFILL_WEBHOOK = process.env.PIPEDREAM_BACKFILL_WEBHOOK || "";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");
  const state = searchParams.get("state");
  const next = searchParams.get("next") ?? "/dashboard";

  // Check if this is a QuickBooks OAuth callback (has realmId)
  if (realmId && code) {
    return handleQBOCallback(request, code, realmId, state, origin);
  }

  // Otherwise, handle as Supabase auth callback
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}

// Handle QuickBooks OAuth callback
async function handleQBOCallback(
  request: Request,
  code: string,
  realmId: string,
  state: string | null,
  origin: string
) {
  try {
    const error = new URL(request.url).searchParams.get("error");

    // Check for OAuth errors
    if (error) {
      console.error("QBO OAuth error:", error);
      return NextResponse.redirect(`${origin}/data-sources?error=${error}`);
    }

    // Verify state for CSRF protection
    const cookieStore = await cookies();
    const storedState = cookieStore.get("qbo_oauth_state")?.value;

    if (storedState && storedState !== state) {
      console.error("State mismatch - possible CSRF attack");
      return NextResponse.redirect(`${origin}/data-sources?error=invalid_state`);
    }

    // Clear the state cookie
    if (storedState) {
      cookieStore.delete("qbo_oauth_state");
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(QBO_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString("base64")}`,
        "Accept": "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: QBO_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return NextResponse.redirect(`${origin}/data-sources?error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    console.log("QBO Token exchange successful");

    // Calculate token expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

    // Get Supabase client
    const supabase = await createClient();

    // Get current user - CRITICAL for user isolation
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("User not authenticated:", userError);
      return NextResponse.redirect(`${origin}/login?error=not_authenticated`);
    }

    console.log("User authenticated:", user.id);

    // Fetch company name from QuickBooks
    let companyName = `QuickBooks Company ${realmId}`;
    try {
      const qboCompanyUrl = `https://quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}`;
      const qboResponse = await fetch(qboCompanyUrl, {
        headers: {
          "Authorization": `Bearer ${tokens.access_token}`,
          "Accept": "application/json",
        },
      });
      
      if (qboResponse.ok) {
        const qboData = await qboResponse.json();
        if (qboData?.CompanyInfo?.CompanyName) {
          companyName = qboData.CompanyInfo.CompanyName;
        }
      }
    } catch (e) {
      console.log("Could not fetch company name from QBO, using default");
    }

    // Check if company already exists for this realm_id AND user
    let companyId: string | null = null;
    let isNewCompany = false;

    const { data: existingCompany } = await supabase
      .from("companies")
      .select("id")
      .eq("realm_id", realmId)
      .eq("user_id", user.id)
      .single();

    if (existingCompany) {
      companyId = existingCompany.id;
    } else {
      // Create a new company with user_id
      const { data: newCompany, error: companyError } = await supabase
        .from("companies")
        .insert({
          name: companyName,
          realm_id: realmId,
          user_id: user.id, // CRITICAL: Link to user
        })
        .select("id")
        .single();

      if (companyError) {
        console.error("Error creating company:", companyError);
        return NextResponse.redirect(`${origin}/data-sources?error=company_creation_failed`);
      }

      companyId = newCompany.id;
      isNewCompany = true;
    }

    // Check if connection already exists for this realm_id AND user
    const { data: existingConnection } = await supabase
      .from("qbo_connections")
      .select("id")
      .eq("realm_id", realmId)
      .eq("user_id", user.id)
      .single();

    let connectionId: string;

    if (existingConnection) {
      connectionId = existingConnection.id;
      // Update existing connection
      const { error: updateError } = await supabase
        .from("qbo_connections")
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingConnection.id);

      if (updateError) {
        console.error("Error updating connection:", updateError);
        return NextResponse.redirect(`${origin}/data-sources?error=connection_update_failed`);
      }
    } else {
      // Create new connection with user_id
      const { data: newConnection, error: insertError } = await supabase
        .from("qbo_connections")
        .insert({
          company_id: companyId,
          user_id: user.id, // CRITICAL: Link to user
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          realm_id: realmId,
          qbo_company_id: realmId,
          expires_at: expiresAt.toISOString(),
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Error creating connection:", insertError);
        return NextResponse.redirect(`${origin}/data-sources?error=connection_creation_failed`);
      }

      connectionId = newConnection.id;
    }

    // Create sync_status record (pending)
    await supabase
      .from("sync_status")
      .insert({
        connection_id: connectionId,
        company_id: companyId,
        sync_type: isNewCompany ? "initial" : "incremental",
        status: "pending",
      });

    // Trigger Pipedream backfill webhook if configured
    // Send tokens so Pipedream can fetch data from QBO API
    if (PIPEDREAM_BACKFILL_WEBHOOK) {
      try {
        console.log("Triggering Pipedream backfill webhook...");
        const webhookPayload = {
          realm_id: realmId,
          company_id: companyId,
          connection_id: connectionId,
          user_id: user.id,
          action: isNewCompany ? "backfill" : "incremental_sync",
          // CRITICAL: Send tokens so Pipedream can call QBO API
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        };
        
        console.log("Webhook payload:", { 
          ...webhookPayload, 
          access_token: "***hidden***",
          refresh_token: "***hidden***"
        });
        
        const webhookResponse = await fetch(PIPEDREAM_BACKFILL_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload),
        });
        
        if (webhookResponse.ok) {
          console.log("Pipedream webhook triggered successfully");
        } else {
          console.error("Pipedream webhook failed:", await webhookResponse.text());
        }
      } catch (e) {
        console.error("Failed to trigger Pipedream webhook:", e);
      }
    } else {
      console.warn("PIPEDREAM_BACKFILL_WEBHOOK not configured - data will not sync automatically");
    }

    console.log("QBO connection saved successfully for realm:", realmId, "user:", user.id);

    // Redirect to data sources page with success message
    return NextResponse.redirect(`${origin}/data-sources?success=connected`);
  } catch (error) {
    console.error("QBO callback error:", error);
    return NextResponse.redirect(`${origin}/data-sources?error=callback_failed`);
  }
}
