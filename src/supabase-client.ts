import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing VITE_SUPABASE_URL. Update your environment config.");
}

if (!supabaseKey) {
  throw new Error("Missing VITE_SUPABASE_KEY. Update your environment config.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
