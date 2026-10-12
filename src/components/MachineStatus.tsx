"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { THB, formatDateTime, timeAgo } from "@/lib/format";
import type { Machine } from "@/lib/types";

// ตู้ส่งสัญญาณชีพทุก ~60 วินาที (server.py: NET_HEARTBEAT_SEC) ถือว่าออนไลน์ถ้าเห็นล่าสุดไม่เกิน 3 นาที
const ONLINE_WITHIN_MS = 3 * 60 * 1000;
const REFRESH_MS = 20 * 1000;

export type MachineStat = { readings: number; revenue: number };

export function MachineStatus({
  machines: initial,
  stats,
  periodLabel,
}: {
  machines: Machine[];
  stats: Record<string, MachineStat>;
  periodLabel: string;
}) {
  const [machines, setMachines] = useState<Machine[]>(initial);
  const [now, setNow] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let stop = false;
    async function refresh() {
      const { data, error } = await supabase.from("tarot_machines").select("*").order("name");
      if (stop) return;
      if (error || !data) {
        setFailed(true);
      } else {
        setFailed(false);
        setMachines(data as Machine[]);
      }
      setNow(Date.now());
    }
    const id = setInterval(refresh, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      stop = true;
      clearInterval(id);
      clearInterval(tick);
    };
  }, []);

  const list = useMemo(() => {
    const rows = machines.map((m) => {
      const seen = m.last_seen_at ? Date.parse(m.last_seen_at) : null;
      return { m, seen, online: seen !== null && now - seen <= ONLINE_WITHIN_MS };
    });
    // ออนไลน์ขึ้นก่อน แล้วเรียงตามที่เห็นล่าสุด
    return rows.sort(
      (a, b) => Number(b.online) - Number(a.online) || (b.seen ?? 0) - (a.seen ?? 0)
    );
  }, [machines, now]);

  const onlineCount = list.filter((r) => r.online).length;

  return (
    <div className="rounded-2xl border border-[#23262e] bg-[#181a20] p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-100">
          เครื่องทั้งหมด{" "}
          <span className="font-normal text-slate-400">
            ({onlineCount} ออนไลน์ / {list.length} เครื่อง)
          </span>
        </h3>
        <span className="text-xs text-slate-500">
          {failed ? "อัปเดตสถานะไม่สำเร็จ แสดงข้อมูลล่าสุดที่มี" : "อัปเดตอัตโนมัติทุก 20 วินาที"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr className="border-b border-[#23262e]">
              <th className="px-4 pb-3 font-normal">สถานะ</th>
              <th className="px-4 pb-3 font-normal">ชื่อเครื่อง</th>
              <th className="px-4 pb-3 font-normal">รหัสเครื่อง</th>
              <th className="px-4 pb-3 font-normal">เห็นล่าสุด</th>
              <th className="px-4 pb-3 text-right font-normal">ทำนาย ({periodLabel})</th>
              <th className="px-4 pb-3 text-right font-normal">ยอดเงิน ({periodLabel})</th>
            </tr>
          </thead>
          <tbody>
            {list.map(({ m, seen, online }) => {
              const s = stats[m.machine_id];
              return (
                <tr key={m.machine_id} className="border-b border-[#23262e] last:border-0">
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs ${
                        online
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-slate-500/10 text-slate-400"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          online ? "animate-pulse bg-emerald-400" : "bg-slate-500"
                        }`}
                      />
                      {online ? "ออนไลน์" : "ออฟไลน์"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-slate-100">{m.name}</td>
                  <td className="px-4 py-3.5 font-mono text-xs text-slate-400">
                    {m.machine_id.slice(0, 12)}
                    {m.machine_id.length > 12 ? "…" : ""}
                  </td>
                  <td
                    className="whitespace-nowrap px-4 py-3.5 text-slate-400"
                    title={m.last_seen_at ? formatDateTime(m.last_seen_at) : undefined}
                  >
                    {seen === null ? "ไม่เคยเชื่อมต่อ" : timeAgo(m.last_seen_at as string, now)}
                  </td>
                  <td className="px-4 py-3.5 text-right">{s ? s.readings : 0}</td>
                  <td className="px-4 py-3.5 text-right">{THB.format(s ? s.revenue : 0)}</td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  ยังไม่มีเครื่อง
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        ออนไลน์ = ตู้ส่งสัญญาณมาภายใน 3 นาทีล่าสุด (ตู้ต้องใช้ server.py เวอร์ชันที่ส่งสัญญาณชีพ ตู้เวอร์ชันเก่าจะขึ้นออฟไลน์
        แม้เปิดอยู่)
      </p>
    </div>
  );
}
