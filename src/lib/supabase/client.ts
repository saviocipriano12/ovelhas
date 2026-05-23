import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL nao foi configurada.");
}

if (!supabasePublishableKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY nao foi configurada.");
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
