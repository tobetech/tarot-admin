import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/DashboardClient";
import type { Machine, Transaction } from "@/lib/types";

// ดึงข้อมูลตั้งต้นฝั่ง server ก่อน render (เร็วกว่ารอโหลดฝั่ง client ทีหลัง)
// จากนั้น DashboardClient จะสมัคร realtime ต่อจากจุดนี้เอง
export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: transactions }, { data: machines }] = await Promise.all([
    supabase
      .from("tarot_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("tarot_machines").select("*").order("name"),
  ]);

  return (
    <DashboardClient
      initialTransactions={(transactions as Transaction[]) ?? []}
      machines={(machines as Machine[]) ?? []}
    />
  );
}
