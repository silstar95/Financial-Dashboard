import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PIPEDREAM_BACKFILL_WEBHOOK = process.env.PIPEDREAM_BACKFILL_WEBHOOK || "";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get the user's QBO connection
    const { data: connection, error: connectionError } = await supabase
      .from("qbo_connections")
      .select("id, company_id, realm_id, access_token, refresh_token")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: "No QBO connection found" },
        { status: 404 }
      );
    }

    // Check if webhook is configured
    if (!PIPEDREAM_BACKFILL_WEBHOOK) {
      return NextResponse.json(
        { error: "Sync webhook not configured" },
        { status: 500 }
      );
    }

    // Create a new sync_status record
    await supabase
      .from("sync_status")
      .insert({
        connection_id: connection.id,
        company_id: connection.company_id,
        sync_type: "manual",
        status: "pending",
      });

    // Trigger Pipedream webhook
    const webhookResponse = await fetch(PIPEDREAM_BACKFILL_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        realm_id: connection.realm_id,
        company_id: connection.company_id,
        connection_id: connection.id,
        user_id: user.id,
        action: "manual_sync",
        access_token: connection.access_token,
        refresh_token: connection.refresh_token,
      }),
    });

    if (!webhookResponse.ok) {
      console.error("Webhook failed:", await webhookResponse.text());
      return NextResponse.json(
        { error: "Failed to trigger sync" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Sync triggered successfully",
    });

  } catch (error) {
    console.error("Trigger sync error:", error);
    return NextResponse.json(
      { error: "Failed to trigger sync" },
      { status: 500 }
    );
  }
}

