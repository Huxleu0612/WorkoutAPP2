import { createClient } from "@supabase/supabase-js";

// Both values come from the Supabase dashboard under Settings -> API. The anon key is
// public by design — it identifies the project, it does not grant access. Row Level
// Security on app_data is what keeps rows private, so this is safe to ship in the bundle.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sync is optional. With no config the app runs exactly as it did before — entirely local,
// no network, no sign-in prompt — so a missing .env is a supported state, not a broken one.
export const syncConfigured = Boolean(url && anonKey);

export const supabase = syncConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
