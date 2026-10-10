import { createClient } from "@/lib/supabase/server";

// เรียก admin API ของ gateway กลาง (license_server.py) จากฝั่ง server เท่านั้น
// ADMIN_TOKEN ห้ามหลุดไปฝั่ง browser จึงไม่ใช้ NEXT_PUBLIC_
const BASE = process.env.LICENSE_API_URL || "https://tarot-api.tobe-tech.com";
const TOKEN = process.env.LICENSE_ADMIN_TOKEN || "";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function gateway(path: string, init: RequestInit = {}) {
  if (!TOKEN) {
    return Response.json(
      { error: "ยังไม่ได้ตั้งค่า LICENSE_ADMIN_TOKEN บนเซิร์ฟเวอร์ของ dashboard" },
      { status: 500 }
    );
  }
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", "X-Admin-Token": TOKEN },
      cache: "no-store",
    });
    return new Response(await res.text(), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return Response.json({ error: "เชื่อมต่อ gateway ไม่สำเร็จ" }, { status: 502 });
  }
}
