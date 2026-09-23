import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase client สำหรับฝั่ง server (Server Components, Server Actions, Route Handlers)
// อ่าน/เขียน session cookie ของผู้ใช้ที่ login อยู่ ผ่าน Next.js cookies()
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
            // เรียกจาก Server Component (ไม่ใช่ Server Action/Route Handler) จะ set cookie ไม่ได้
            // ข้ามไปได้เพราะ middleware.ts เป็นตัวรีเฟรช session ให้อยู่แล้ว
          }
        },
      },
    }
  );
}
