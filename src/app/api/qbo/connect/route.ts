import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// QuickBooks OAuth Configuration
const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID || "";
const QBO_REDIRECT_URI = process.env.NODE_ENV === "production"
  ? "https://quickbooks-project.vercel.app/auth/callback"
  : "http://localhost:3000/auth/callback";

// QuickBooks OAuth URLs
const QBO_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";

// Scopes required for QuickBooks access
// Note: Only requesting accounting scope - payments scope requires merchant account approval
const QBO_SCOPES = [
  "com.intuit.quickbooks.accounting",
  // "com.intuit.quickbooks.payment", // Removed - requires approved merchant account
].join(" ");

export async function GET(request: Request) {
  try {
    // Check if client ID is configured
    if (!QBO_CLIENT_ID) {
      console.error("QBO_CLIENT_ID is not configured");
      return NextResponse.redirect(
        new URL("/data-sources?error=not_configured", request.url)
      );
    }

    // Generate a random state for CSRF protection
    const state = crypto.randomUUID();

    // Store state in cookie for verification during callback (await in Next.js 15)
    const cookieStore = await cookies();
    cookieStore.set("qbo_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes
      path: "/",
    });

    // Build the authorization URL
    const authUrl = new URL(QBO_AUTH_URL);
    authUrl.searchParams.set("client_id", QBO_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", QBO_REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", QBO_SCOPES);
    authUrl.searchParams.set("state", state);

    console.log("Redirecting to QuickBooks OAuth:", authUrl.toString());

    // Redirect to QuickBooks authorization page
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating QBO OAuth:", error);
    return NextResponse.redirect(
      new URL("/data-sources?error=oauth_init_failed", request.url)
    );
  }
}

