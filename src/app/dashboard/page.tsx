import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/DashboardClient";
import type { Machine } from "@/lib/types";

// ดึงรายชื่อตู้ฝั่ง server ก่อน render ส่วนธุรกรรมให้ DashboardClient โหลดเองตามช่วงเวลาที่เลือก
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: machines } = await supabase
    .from("tarot_machines")
    .select("*")
    .order("name");

  return <DashboardClient machines={(machines as Machine[]) ?? []} />;
}
