import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Fallback values from original config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amvshhoizeujspkgypke.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtdnNoaG9pemV1anNwa2d5cGtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NDkyODIsImV4cCI6MjA3NDQyNTI4Mn0.EGubhs3SuiBmhDKYHs-RcFUxpaG88W8ulslwf4Go4h4";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}

