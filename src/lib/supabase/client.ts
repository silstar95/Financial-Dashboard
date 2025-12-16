"use client";

import { createBrowserClient } from "@supabase/ssr";

// Fallback values from original config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amvshhoizeujspkgypke.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtdnNoaG9pemV1anNwa2d5cGtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NDkyODIsImV4cCI6MjA3NDQyNTI4Mn0.EGubhs3SuiBmhDKYHs-RcFUxpaG88W8ulslwf4Go4h4";

// Singleton pattern to avoid multiple GoTrueClient instances
let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!client) {
    client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

