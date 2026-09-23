import { createBrowserClient } from "@supabase/ssr";

// Supabase client สำหรับฝั่ง browser (Client Components) เช่น หน้า login,
// และตัว subscribe realtime บน dashboard
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
