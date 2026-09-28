"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  PAYMENT_METHOD_LABELS,
  SEIZA_LANGUAGE_LABELS,
  SEIZA_TOPIC_LABELS,
  type Machine,
  type SeizaTransaction,
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

// "เมื่อ 5 นาทีที่แล้ว" - ไว้โชว์ว่าตู้ติดต่อเข้ามาล่าสุดเมื่อไร
function timeAgo(iso: string | null) {
  if (!iso) return "ยังไม่เคยติดต่อ";
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "เมื่อสักครู่";
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`;
  return `${Math.floor(diffHr / 24)} วันที่แล้ว`;
}

export function SeizaDashboardClient({
  initialTransactions,
  machines: initialMachines,
}: {
  initialTransactions: SeizaTransaction[];
  machines: Machine[];
}) {
  const [transactions, setTransactions] =
    useState<SeizaTransaction[]>(initialTransactions);
  const [machines, setMachines] = useState<Machine[]>(initialMachines);
  const [selectedMachine, setSelectedMachine] = useState<string>("all");
  const [connected, setConnected] = useState(false);

  // realtime แบบเดียวกับหน้าไพ่ยิปซี - ต้อง setAuth ด้วย access_token ของผู้ใช้ก่อน subscribe
  // ไม่งั้น realtime จะต่อด้วยสิทธิ์ anon ซึ่ง RLS ของ seiza_transactions ไม่อนุญาตให้อ่าน
  // (สถานะจะขึ้นเขียวแต่ข้อมูลใหม่ไม่มาเงียบๆ - ดูคำอธิบายเต็มใน DashboardClient.tsx)
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }

      channel = supabase
        .channel("seiza-transactions-realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "seiza_transactions" },
          (payload) => {
            const txn = payload.new as SeizaTransaction;
            setTransactions((prev) => [txn, ...prev].slice(0, 500));
            // ตู้ที่เพิ่งส่งธุรกรรมเข้ามา = ยังออนไลน์อยู่ อัปเดตเวลาติดต่อล่าสุดบนจอทันที
            setMachines((prev) =>
              prev.map((m) =>
                m.machine_id === txn.machine_id
                  ? { ...m, last_seen_at: txn.created_at }
                  : m
              )
            );
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

  // นับจากรายการ "ทำนาย" เท่านั้น (1 ครั้ง = 1 คำทำนาย) และโชว์เฉพาะภาษาที่มีคนใช้จริง
  // เพราะตู้นี้มี 9 ภาษา ถ้าโชว์ครบทุกภาษาที่เป็น 0 รายการจะยาวเกินการ์ด
  const languageCounts = Object.entries(SEIZA_LANGUAGE_LABELS)
    .map(([code, label]) => ({
      name: label,
      value: todayReadings.filter((t) => t.language === code).length,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const topicCounts = Object.entries(SEIZA_TOPIC_LABELS)
    .map(([code, label]) => ({
      name: label,
      value: todayReadings.filter((t) => t.topic === code).length,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

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
          icon="✨"
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
        <BreakdownChart title="หัวข้อที่ดู (วันนี้)" data={topicCounts} />
        <BreakdownChart title="ภาษาที่เลือกใช้ (วันนี้)" data={languageCounts} />

        {/* สถานะตู้ */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-medium text-slate-300">ตู้ทั้งหมด</h3>
          {machines.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-500">
              ยังไม่มีตู้ลงทะเบียน
            </div>
          ) : (
            <ul className="space-y-3">
              {machines.map((m) => {
                const readingsToday = transactions.filter(
                  (t) =>
                    t.machine_id === m.machine_id &&
                    t.kind === "reading" &&
                    isToday(t.created_at)
                ).length;
                return (
                  <li
                    key={m.machine_id}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-100">
                        {m.name}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {m.location || m.machine_id}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-slate-200">{readingsToday} ครั้ง</div>
                      <div className="text-xs text-slate-500">
                        {timeAgo(m.last_seen_at)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Realtime feed */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-medium text-slate-300">
          ธุรกรรมล่าสุด (realtime)
        </h3>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-900 text-xs text-slate-500">
              <tr>
                <th className="pb-2 pr-2 font-normal">เวลา</th>
                <th className="pb-2 pr-2 font-normal">ประเภท</th>
                <th className="pb-2 pr-2 font-normal">ช่องทาง</th>
                <th className="pb-2 pr-2 font-normal">จำนวนเงิน</th>
                <th className="pb-2 pr-2 font-normal">หัวข้อ</th>
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
                    {t.payment_method ? PAYMENT_METHOD_LABELS[t.payment_method] : "—"}
                  </td>
                  <td className="py-2 pr-2 font-medium">
                    {t.amount != null ? THB.format(t.amount) : "—"}
                  </td>
                  <td className="py-2 pr-2 text-slate-400">
                    {t.topic ? SEIZA_TOPIC_LABELS[t.topic] ?? t.topic : "—"}
                  </td>
                  <td className="py-2 pr-2 text-slate-400">
                    {t.language ? SEIZA_LANGUAGE_LABELS[t.language] ?? t.language : "—"}
                  </td>
                  <td className="py-2 text-slate-400 whitespace-nowrap">
                    {machineLabel(t.machine_id)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    ยังไม่มีธุรกรรม
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
