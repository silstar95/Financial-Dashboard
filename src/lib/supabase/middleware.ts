import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Fallback values from original config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amvshhoizeujspkgypke.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtdnNoaG9pemV1anNwa2d5cGtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NDkyODIsImV4cCI6MjA3NDQyNTI4Mn0.EGubhs3SuiBmhDKYHs-RcFUxpaG88W8ulslwf4Go4h4";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Get user - this validates the session with Supabase server
  const { data: { user }, error } = await supabase.auth.getUser();
  
  const pathname = request.nextUrl.pathname;
  
  // Public routes that don't require authentication
  const isAuthRoute = pathname.startsWith("/auth");
  const isLoginRoute = pathname === "/login";
  const isPublicRoute = isAuthRoute || isLoginRoute;
  
  // Debug logging (remove in production)
  console.log(`[Middleware] Path: ${pathname}, User: ${user?.email || "none"}, Error: ${error?.message || "none"}`);

  // NOT logged in
  if (!user) {
    // Allow access to public routes
    if (isPublicRoute) {
      return supabaseResponse;
    }
    // Redirect to login for protected routes
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    console.log(`[Middleware] Redirecting to /login (no user)`);
    return NextResponse.redirect(url);
  }

  // LOGGED IN
  // Redirect away from login page
  if (isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    console.log(`[Middleware] Redirecting to /dashboard (user on login page)`);
    return NextResponse.redirect(url);
  }

  // Redirect from home to dashboard
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    console.log(`[Middleware] Redirecting to /dashboard (user on home)`);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

