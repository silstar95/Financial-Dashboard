import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const supabase = await createClient();
  
  // Get current user before signing out
  const { data: { user } } = await supabase.auth.getUser();
  
  // SECURITY: Disconnect QBO and delete all user data before logout
  if (user) {
    console.log("🔐 [Signout] Disconnecting QBO for user:", user.id);
    
    try {
      // Delete QBO connections for this user
      // This will trigger the cascade delete of all related data (transactions, monthly_pl, etc.)
      const { error: disconnectError } = await supabase
        .from("qbo_connections")
        .delete()
        .eq("user_id", user.id);
      
      if (disconnectError) {
        console.error("🔐 [Signout] Error disconnecting QBO:", disconnectError);
      } else {
        console.log("🔐 [Signout] QBO disconnected successfully - all data cleaned up");
      }
    } catch (err) {
      console.error("🔐 [Signout] Error during QBO cleanup:", err);
    }
  }
  
  // Sign out on server side - this clears the session in Supabase
  await supabase.auth.signOut();
  
  // Get all cookies to clear
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  
  // Create response
  const response = NextResponse.json({ success: true });
  
  // Clear all Supabase related cookies with proper options
  allCookies.forEach((cookie) => {
    if (cookie.name.includes("supabase") || cookie.name.includes("sb-")) {
      response.cookies.set(cookie.name, "", {
        expires: new Date(0),
        path: "/",
      });
    }
  });
  
  // Also try to clear common Supabase cookie patterns
  const commonCookieNames = [
    "sb-access-token",
    "sb-refresh-token", 
    `sb-amvshhoizeujspkgypke-auth-token`,
  ];
  
  commonCookieNames.forEach((name) => {
    response.cookies.set(name, "", {
      expires: new Date(0),
      path: "/",
    });
  });
  
  return response;
}

