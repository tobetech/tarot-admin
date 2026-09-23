"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  LANGUAGE_LABELS,
  PAYMENT_METHOD_LABELS,
  type Machine,
  type Transaction,
} from "@/lib/types";
import { StatCard } from "@/components/StatCard";
import { BreakdownChart } from "@/components/BreakdownChart";
import { RevenueChart } from "@/components/RevenueChart";

const THB = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

export function DashboardClient({
  initialTransactions,
  machines,
}: {
  initialTransactions: Transaction[];
  machines: Machine[];
}) {
  const [transactions, setTransactions] = useState<Transaction[]>(
    initialTransactions
  );
  const [selectedMachine, setSelectedMachine] = useState<string>("all");
  const [connected, setConnected] = useState(false);

  // สมัคร realtime: ทุกครั้งที่มีแถวใหม่ถูก insert ในตาราง transactions
  // ให้เอามาต่อหน้าลิสต์ทันที ไม่ต้อง refresh หน้าเว็บ
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // สำคัญ: ต้องส่ง access_token ของผู้ใช้ที่ login อยู่ให้ตัว realtime รู้จักก่อน subscribe
    // เสมอ ไม่งั้น realtime จะต่อด้วยสิทธิ์ "anon" (ยังไม่ login) แทน ซึ่งตาราง
    // tarot_transactions ตั้ง RLS ไว้ให้อ่านได้เฉพาะ "authenticated" เท่านั้น - ถ้าข้ามขั้นตอนนี้
    // ปุ่มสถานะจะขึ้นเขียว "เชื่อมต่อแล้ว" ได้ปกติ แต่ database จะไม่ส่งข้อมูลใหม่มาให้เลยเงียบๆ
    // (ต้อง refresh หน้าถึงจะเห็น เพราะตอน refresh ไปดึงข้อมูลผ่าน server-side ที่ใช้สิทธิ์ถูกต้องอยู่แล้ว)
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }

      channel = supabase
        .channel("transactions-realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "tarot_transactions" },
          (payload) => {
            setTransactions((prev) => [
              payload.new as Transaction,
              ...prev,
            ].slice(0, 500));
          }
        )
        .subscribe((status) => {
          setConnected(status === "SUBSCRIBED");
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    if (selectedMachine === "all") return transactions;
    return transactions.filter((t) => t.machine_id === selectedMachine);
  }, [transactions, selectedMachine]);

  // แปลง machine_id (รหัส token ยาวๆ) เป็นชื่อตู้ที่อ่านง่าย เช่น "Raspberry Pi ตู้ 1"
  // (ชื่อนี้มาจากตาราง tarot_machines คอลัมน์ name - gateway อัปเดตให้อัตโนมัติทุกครั้งที่มี
  // ธุรกรรมเข้ามา โดยใช้ชื่อที่ตั้งไว้ตอนสร้าง license) ถ้าหาไม่เจอ (ยังไม่เคยลงทะเบียน) ให้
  // โชว์ machine_id ดิบๆ ไปก่อนเป็น fallback
  const machineNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    machines.forEach((m) => {
      map[m.machine_id] = m.name;
    });
    return map;
  }, [machines]);

  const machineLabel = (machineId: string) => machineNameMap[machineId] ?? machineId;

  const todayTopups = filtered.filter(
    (t) => t.kind === "topup" && t.status === "completed" && isToday(t.created_at)
  );
  const todayReadings = filtered.filter(
    (t) => t.kind === "reading" && t.status === "completed" && isToday(t.created_at)
  );
  const todayRevenue = todayTopups.reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const todayCash = todayTopups.filter((t) => t.payment_method === "cash");
  const todayQr = todayTopups.filter((t) => t.payment_method === "qr");

  const paymentBreakdown = [
    {
      name: PAYMENT_METHOD_LABELS.cash,
      value: todayCash.reduce((s, t) => s + (t.amount ?? 0), 0),
    },
    {
      name: PAYMENT_METHOD_LABELS.qr,
      value: todayQr.reduce((s, t) => s + (t.amount ?? 0), 0),
    },
  ];

  const languageCounts = Object.entries(LANGUAGE_LABELS).map(([code, label]) => ({
    name: label,
    value: filtered.filter(
      (t) => t.language === code && isToday(t.created_at)
    ).length,
  }));

  const revenueByDay = useMemo(() => {
    const days: { day: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "2-digit",
      });
      const dayRevenue = filtered
        .filter(
          (t) =>
            t.kind === "topup" &&
            t.status === "completed" &&
            new Date(t.created_at).toDateString() === d.toDateString()
        )
        .reduce((sum, t) => sum + (t.amount ?? 0), 0);
      days.push({ day: key, revenue: dayRevenue });
    }
    return days;
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* แถบตัวกรองตู้ + สถานะ realtime */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400">ตู้:</label>
          <select
            value={selectedMachine}
            onChange={(e) => setSelectedMachine(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-amber-500"
          >
            <option value="all">ทุกตู้</option>
            {machines.map((m) => (
              <option key={m.machine_id} value={m.machine_id}>
                {m.name} ({m.machine_id})
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span
            className={`h-2 w-2 rounded-full ${
              connected ? "bg-emerald-400" : "bg-slate-600"
            }`}
          />
          {connected ? "เชื่อมต่อ realtime แล้ว" : "กำลังเชื่อมต่อ..."}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="ยอดขายวันนี้"
          value={THB.format(todayRevenue)}
          sub={`${todayTopups.length} ธุรกรรม`}
          icon="💰"
          accent="amber"
        />
        <StatCard
          label="ทำนายวันนี้"
          value={String(todayReadings.length)}
          sub="ครั้ง"
          icon="🔮"
          accent="violet"
        />
        <StatCard
          label="เงินสด"
          value={THB.format(todayCash.reduce((s, t) => s + (t.amount ?? 0), 0))}
          sub={`${todayCash.length} รายการ`}
          icon="💵"
          accent="emerald"
        />
        <StatCard
          label="QR Code"
          value={THB.format(todayQr.reduce((s, t) => s + (t.amount ?? 0), 0))}
          sub={`${todayQr.length} รายการ`}
          icon="📱"
          accent="sky"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart data={revenueByDay} />
        </div>
        <BreakdownChart title="ช่องทางชำระเงิน (วันนี้)" data={paymentBreakdown} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BreakdownChart title="ภาษาที่เลือกใช้ (วันนี้)" data={languageCounts} />

        {/* Realtime feed */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-medium text-slate-300">
            ธุรกรรมล่าสุด (realtime)
          </h3>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-900 text-xs text-slate-500">
                <tr>
                  <th className="pb-2 pr-2 font-normal">เวลา</th>
                  <th className="pb-2 pr-2 font-normal">ประเภท</th>
                  <th className="pb-2 pr-2 font-normal">ช่องทาง</th>
                  <th className="pb-2 pr-2 font-normal">จำนวนเงิน</th>
                  <th className="pb-2 pr-2 font-normal">ภาษา</th>
                  <th className="pb-2 font-normal">ตู้</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.slice(0, 50).map((t) => (
                  <tr key={t.id} className="text-slate-200">
                    <td className="py-2 pr-2 whitespace-nowrap text-slate-400">
                      {formatTime(t.created_at)}
                    </td>
                    <td className="py-2 pr-2">
                      {t.kind === "topup" ? (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                          รับเงิน
                        </span>
                      ) : (
                        <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-xs text-violet-400">
                          ทำนาย
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-slate-400">
                      {t.payment_method
                        ? PAYMENT_METHOD_LABELS[t.payment_method]
                        : "—"}
                    </td>
                    <td className="py-2 pr-2 font-medium">
                      {t.amount != null ? THB.format(t.amount) : "—"}
                    </td>
                    <td className="py-2 pr-2 text-slate-400">
                      {t.language ? LANGUAGE_LABELS[t.language] : "—"}
                    </td>
                    <td className="py-2 text-slate-400">{machineLabel(t.machine_id)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      ยังไม่มีธุรกรรม
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
