import { createClient } from "@/lib/supabase/server";
import { SeizaDashboardClient } from "@/components/SeizaDashboardClient";
import type { Machine, SeizaTransaction } from "@/lib/types";

// หน้าตู้เซซะอุราไน - โครงเดียวกับหน้าไพ่ยิปซี (/dashboard): ดึงข้อมูลตั้งต้นฝั่ง server
// แล้วให้ SeizaDashboardClient สมัคร realtime ต่อ (ตาราง seiza_transactions)
export default async function SeizaDashboardPage() {
  const supabase = await createClient();

  const [{ data: transactions }, { data: machines }] = await Promise.all([
    supabase
      .from("seiza_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("seiza_machines").select("*").order("name"),
  ]);

  return (
    <SeizaDashboardClient
      initialTransactions={(transactions as SeizaTransaction[]) ?? []}
      machines={(machines as Machine[]) ?? []}
    />
  );
}
