import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://amvshhoizeujspkgypke.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtdnNoaG9pemV1anNwa2d5cGtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NDkyODIsImV4cCI6MjA3NDQyNTI4Mn0.EGubhs3SuiBmhDKYHs-RcFUxpaG88W8ulslwf4Go4h4";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);