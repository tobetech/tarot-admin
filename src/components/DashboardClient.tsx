"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  LANGUAGE_LABELS,
  TOPIC_LABELS,
  PAYMENT_METHOD_LABELS,
  type Machine,
  type Transaction,
} from "@/lib/types";
import {
  THB,
  bkkDate,
  dayRange,
  formatDateTime,
  nextDayIso,
  sinceStartOfDay,
  startOfDateIso,
} from "@/lib/format";
import { StatCard } from "@/components/StatCard";
import {
  COLORS,
  ChartCard,
  ColoredPie,
  DailyLineChart,
  HBarChart,
} from "@/components/Charts";
import { LicenseTab } from "@/components/LicenseTab";
import { MachineStatus, type MachineStat } from "@/components/MachineStatus";

const PERIODS = [
  { id: "7", label: "7 วันล่าสุด", days: 7 },
  { id: "1", label: "วันนี้", days: 1 },
  { id: "30", label: "30 วันล่าสุด", days: 30 },
  { id: "90", label: "90 วันล่าสุด", days: 90 },
  { id: "all", label: "ทั้งหมด", days: 0 },
  { id: "custom", label: "เลือกวันที่จากปฏิทิน...", days: 0 },
];

const PAGE = 1000; // Supabase ตอบกลับสูงสุด 1000 แถวต่อครั้ง จึงดึงเป็นหน้าๆ
const MAX_ROWS = 20000;

const selectClass =
  "rounded-xl border border-[#2a2d36] bg-[#181a20] px-4 py-3 text-slate-100 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50";
const darkBtn =
  "rounded-xl border border-[#2a2d36] bg-[#1c1e26] px-5 py-3 font-semibold text-slate-100 transition hover:bg-[#252833]";

export function DashboardClient({ machines }: { machines: Machine[] }) {
  const [tab, setTab] = useState<"sales" | "license">("sales");
  const [period, setPeriod] = useState("7");
  const [machine, setMachine] = useState("all");
  const today = bkkDate(new Date());
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ช่วงเวลาที่เลือก: since (รวม) ถึง until (ไม่รวม) ถ้าเป็น null = ไม่จำกัด
  const { since, until } = useMemo(() => {
    if (period === "custom") {
      const a = fromDate <= toDate ? fromDate : toDate;
      const b = fromDate <= toDate ? toDate : fromDate;
      return { since: startOfDateIso(a), until: nextDayIso(b) };
    }
    const p = PERIODS.find((x) => x.id === period);
    return { since: p && p.days > 0 ? sinceStartOfDay(p.days) : null, until: null as string | null };
  }, [period, fromDate, toDate]);

  // ดึงรายการรับเงิน (topup) และการเริ่มทำนาย (reading) ที่สำเร็จแล้ว ตามช่วงเวลาที่เลือก
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const all: Transaction[] = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      let q = supabase
        .from("tarot_transactions")
        .select("*")
        .in("kind", ["topup", "reading"])
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (since) q = q.gte("created_at", since);
      if (until) q = q.lt("created_at", until);
      const { data, error: err } = await q;
      if (err) {
        setError(err.message);
        break;
      }
      all.push(...((data as Transaction[]) ?? []));
      if (!data || data.length < PAGE) break;
    }
    setRows(all);
    setLoading(false);
  }, [since, until]);

  useEffect(() => {
    load();
  }, [load]);

  // realtime: มีรายการใหม่เข้ามา ให้เพิ่มต่อหัวลิสต์ทันที (ถ้าอยู่ในช่วงเวลาที่เลือก)
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // ต้องส่ง access_token ของผู้ใช้ที่ login ให้ realtime ก่อน subscribe เสมอ
    // ไม่งั้นจะต่อด้วยสิทธิ์ anon ซึ่งอ่านตารางที่ตั้ง RLS ไว้ไม่ได้ (เงียบๆ ไม่มี error)
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
      channel = supabase
        .channel("transactions-realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "tarot_transactions" },
          (payload) => {
            const t = payload.new as Transaction;
            if (t.status !== "completed") return;
            if (since && t.created_at < since) return;
            if (until && t.created_at >= until) return;
            setRows((prev) => [t, ...prev]);
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [since, until]);

  const machineName = useMemo(() => {
    const map: Record<string, string> = {};
    machines.forEach((m) => (map[m.machine_id] = m.name));
    return (id: string) => map[id] ?? id;
  }, [machines]);

  const byMachineRows = useMemo(
    () => (machine === "all" ? rows : rows.filter((t) => t.machine_id === machine)),
    [rows, machine]
  );
  // ยอดขาย = รายการรับเงิน, สถิติหัวข้อ = รายการเริ่มทำนาย (หัวข้อถูกเลือกหลังจ่ายเงิน)
  const filtered = useMemo(() => byMachineRows.filter((t) => t.kind === "topup"), [byMachineRows]);
  const readings = useMemo(() => byMachineRows.filter((t) => t.kind === "reading"), [byMachineRows]);

  const sum = (list: Transaction[]) =>
    list.reduce((s, t) => s + (t.amount ?? 0), 0);
  const cashRows = filtered.filter((t) => t.payment_method === "cash");
  const qrRows = filtered.filter((t) => t.payment_method === "qr");
  const total = sum(filtered);
  const cash = sum(cashRows);
  const qr = sum(qrRows);
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  const daily = useMemo(() => {
    const first = since ?? (rows.length ? rows[rows.length - 1].created_at : new Date().toISOString());
    const days = dayRange(first, until ? bkkDate(new Date(Date.parse(until) - 1)) : undefined);
    const map = new Map(days.map((d) => [d, { date: d, cash: 0, qr: 0 }]));
    filtered.forEach((t) => {
      const e = map.get(bkkDate(t.created_at));
      if (!e) return;
      if (t.payment_method === "cash") e.cash += t.amount ?? 0;
      else if (t.payment_method === "qr") e.qr += t.amount ?? 0;
    });
    return Array.from(map.values());
  }, [filtered, since, until, rows]);

  const byMachine = useMemo(() => {
    const map = new Map<string, { id: string; cash: number; qr: number; count: number }>();
    filtered.forEach((t) => {
      const e = map.get(t.machine_id) ?? { id: t.machine_id, cash: 0, qr: 0, count: 0 };
      if (t.payment_method === "cash") e.cash += t.amount ?? 0;
      else if (t.payment_method === "qr") e.qr += t.amount ?? 0;
      e.count += 1;
      map.set(t.machine_id, e);
    });
    return Array.from(map.values()).sort((a, b) => b.cash + b.qr - (a.cash + a.qr));
  }, [filtered]);

  const countBy = (
    list: Transaction[],
    key: (t: Transaction) => string | null | undefined
  ) => {
    const map = new Map<string, number>();
    list.forEach((t) => {
      const k = key(t);
      if (k) map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map, ([name, value]) => ({ name, value })).sort(
      (a, b) => b.value - a.value
    );
  };
  const machineStats = useMemo(() => {
    const m: Record<string, MachineStat> = {};
    rows.forEach((t) => {
      const s = (m[t.machine_id] ??= { readings: 0, revenue: 0 });
      if (t.kind === "reading") s.readings += 1;
      else s.revenue += t.amount ?? 0;
    });
    return m;
  }, [rows]);
  const byLanguage = countBy(readings, (t) =>
    t.language ? LANGUAGE_LABELS[t.language] ?? t.language : "ไม่ระบุ"
  );
  const byTopic = countBy(readings, (t) => (t.topic ? TOPIC_LABELS[t.topic] ?? t.topic : null));

  function exportCsv() {
    const head = ["เวลา", "เครื่อง", "ช่องทาง", "จำนวนเงิน", "ภาษา"];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = filtered.map((t) =>
      [
        formatDateTime(t.created_at),
        machineName(t.machine_id),
        t.payment_method ? PAYMENT_METHOD_LABELS[t.payment_method] : "",
        (t.amount ?? 0).toFixed(2),
        t.language ? LANGUAGE_LABELS[t.language] ?? t.language : "",
      ]
        .map(esc)
        .join(",")
    );
    // BOM ให้ Excel อ่านภาษาไทยถูกต้อง
    const blob = new Blob(["﻿" + [head.map(esc).join(","), ...lines].join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tarot-sales-${bkkDate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-6">
      {/* หัวหน้า + ปุ่ม */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-slate-100">
          🔮 แดชบอร์ดยอดขาย ตู้ไพ่ยิปซี
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={exportCsv}
            className="rounded-xl bg-[#f0d27d] px-5 py-3 font-semibold text-[#1b1708] transition hover:bg-[#f5dc95]"
          >
            📥 Export Excel
          </button>
          <button onClick={load} className={darkBtn}>
            รีเฟรช
          </button>
          <form action="/auth/logout" method="post">
            <button type="submit" className={darkBtn}>
              ออกจากระบบ
            </button>
          </form>
        </div>
      </div>

      {/* แท็บ */}
      <div className="flex gap-2 border-b border-[#23262e]">
        {(
          [
            ["sales", "📊 ยอดขาย"],
            ["license", "🔑 จัดการตู้ (License)"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-5 py-3 text-base transition ${
              tab === id
                ? "border-[#eed587] font-bold text-[#eed587]"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "license" ? (
        <LicenseTab />
      ) : (
        <>
          <MachineStatus
            machines={machines}
            stats={machineStats}
            periodLabel={PERIODS.find((p) => p.id === period)?.label ?? ""}
          />
          <div className="flex flex-wrap gap-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className={selectClass}
            >
              {PERIODS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <select
              value={machine}
              onChange={(e) => setMachine(e.target.value)}
              className={selectClass}
            >
              <option value="all">ทุกเครื่อง</option>
              {machines.map((m) => (
                <option key={m.machine_id} value={m.machine_id}>
                  {m.name}
                </option>
              ))}
            </select>
            {period === "custom" && (
              <>
                <label className="flex items-center gap-2 text-sm text-slate-400">
                  ตั้งแต่
                  <input
                    type="date"
                    value={fromDate}
                    max={today}
                    onChange={(e) => e.target.value && setFromDate(e.target.value)}
                    className={selectClass}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-400">
                  ถึง
                  <input
                    type="date"
                    value={toDate}
                    max={today}
                    onChange={(e) => e.target.value && setToDate(e.target.value)}
                    className={selectClass}
                  />
                </label>
              </>
            )}
            {loading && (
              <span className="self-center text-sm text-slate-500">กำลังโหลด...</span>
            )}
            {error && (
              <span className="self-center text-sm text-red-400">โหลดข้อมูลไม่สำเร็จ: {error}</span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <StatCard
              label="ยอดขายรวม"
              value={THB.format(total)}
              sub={`${filtered.length} รายการ`}
              color={COLORS.gold}
            />
            <StatCard
              label="💵 เงินสด"
              value={THB.format(cash)}
              sub={`${pct(cash)}% ของยอดรวม`}
              color={COLORS.green}
            />
            <StatCard
              label="📱 QR"
              value={THB.format(qr)}
              sub={`${pct(qr)}% ของยอดรวม`}
              color={COLORS.blue}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ChartCard title="ยอดขายรายวัน (เงินสด vs QR)">
              <DailyLineChart data={daily} />
            </ChartCard>
            <ChartCard title="สัดส่วนช่องทางชำระเงิน">
              <ColoredPie
                data={[
                  { name: "เงินสด", value: cash },
                  { name: "QR", value: qr },
                ]}
                colors={[COLORS.green, COLORS.blue]}
              />
            </ChartCard>
          </div>

          <ChartCard title="ยอดขายแยกตามเครื่อง">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-400">
                  <tr className="border-b border-[#23262e]">
                    <th className="px-4 pb-3 font-normal">เครื่อง</th>
                    <th className="px-4 pb-3 font-normal">เงินสด</th>
                    <th className="px-4 pb-3 font-normal">QR</th>
                    <th className="px-4 pb-3 font-normal">รวม</th>
                    <th className="px-4 pb-3 font-normal">จำนวนรายการ</th>
                  </tr>
                </thead>
                <tbody>
                  {byMachine.map((m) => (
                    <tr key={m.id} className="border-b border-[#23262e] last:border-0">
                      <td className="px-4 py-3.5">{machineName(m.id)}</td>
                      <td className="px-4 py-3.5">{THB.format(m.cash)}</td>
                      <td className="px-4 py-3.5">{THB.format(m.qr)}</td>
                      <td className="px-4 py-3.5 font-bold">{THB.format(m.cash + m.qr)}</td>
                      <td className="px-4 py-3.5">{m.count}</td>
                    </tr>
                  ))}
                  {byMachine.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        ยังไม่มีข้อมูล
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ChartCard>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ChartCard title="ประเภทคำทำนายที่เลือก">
              <HBarChart
                data={byTopic}
                emptyText="ยังไม่มีข้อมูล (จะเริ่มสะสมเมื่อตู้ที่อัปเดตแล้วมีลูกค้าเลือกหัวข้อ)"
              />
            </ChartCard>
            <ChartCard title="ภาษาที่เลือก (นับจากการทำนาย)">
              <HBarChart data={byLanguage} />
            </ChartCard>
          </div>

          <ChartCard title="รายการล่าสุด (สูงสุด 100 รายการ)">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-400">
                  <tr className="border-b border-[#23262e]">
                    <th className="px-4 pb-3 font-normal">เวลา</th>
                    <th className="px-4 pb-3 font-normal">เครื่อง</th>
                    <th className="px-4 pb-3 font-normal">ช่องทาง</th>
                    <th className="px-4 pb-3 font-normal">จำนวนเงิน</th>
                    <th className="px-4 pb-3 font-normal">ภาษา</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 100).map((t) => (
                    <tr key={t.id} className="border-b border-[#23262e] last:border-0">
                      <td className="whitespace-nowrap px-4 py-3">{formatDateTime(t.created_at)}</td>
                      <td className="px-4 py-3">{machineName(t.machine_id)}</td>
                      <td className="px-4 py-3">
                        {t.payment_method ? PAYMENT_METHOD_LABELS[t.payment_method] : "—"}
                      </td>
                      <td className="px-4 py-3">{THB.format(t.amount ?? 0)}</td>
                      <td className="px-4 py-3">
                        {t.language ? LANGUAGE_LABELS[t.language] ?? t.language : "—"}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        ยังไม่มีรายการ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      )}
    </div>
  );
}
