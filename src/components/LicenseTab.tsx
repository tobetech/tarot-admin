"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";

type License = {
  name: string;
  machine_id: string | null;
  active: boolean;
  created_at: number; // unix seconds
};

const darkBtn =
  "rounded-lg border border-[#2a2d36] bg-[#1c1e26] px-3 py-1.5 text-sm text-slate-100 transition hover:bg-[#252833] disabled:opacity-50";

export function LicenseTab() {
  const [list, setList] = useState<Record<string, License>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/licenses", { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setList(body);
      setError(null);
    } else {
      setError(body?.error ?? `โหลดไม่สำเร็จ (${res.status})`);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function call(url: string, init?: RequestInit) {
    setBusy(true);
    const res = await fetch(url, init);
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(body?.error ?? `ทำรายการไม่สำเร็จ (${res.status})`);
    else await load();
  }

  const entries = Object.entries(list).sort(
    (a, b) => b[1].created_at - a[1].created_at
  );

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#23262e] bg-[#181a20] p-6">
        <h3 className="mb-4 text-base font-semibold text-slate-100">สร้าง License ใหม่</h3>
        <form
          className="flex flex-wrap gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            await call("/api/licenses", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name }),
            });
            setName("");
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อตู้ / ลูกค้า"
            className="min-w-64 flex-1 rounded-xl border border-[#2a2d36] bg-[#12141a] px-4 py-3 text-slate-100 outline-none focus:border-blue-400"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-[#f0d27d] px-5 py-3 font-semibold text-[#1b1708] transition hover:bg-[#f5dc95] disabled:opacity-50"
          >
            สร้าง License
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>

      <div className="rounded-2xl border border-[#23262e] bg-[#181a20] p-6">
        <h3 className="mb-4 text-base font-semibold text-slate-100">
          License ทั้งหมด {loading ? "(กำลังโหลด...)" : `(${entries.length})`}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr className="border-b border-[#23262e]">
                <th className="px-4 pb-3 font-normal">ชื่อ</th>
                <th className="px-4 pb-3 font-normal">License key</th>
                <th className="px-4 pb-3 font-normal">เครื่องที่ผูก</th>
                <th className="px-4 pb-3 font-normal">สถานะ</th>
                <th className="px-4 pb-3 font-normal">สร้างเมื่อ</th>
                <th className="px-4 pb-3 font-normal">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([key, l]) => (
                <tr key={key} className="border-b border-[#23262e] last:border-0">
                  <td className="px-4 py-3.5">
                    {editKey === key ? (
                      <form
                        className="flex gap-2"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!editName.trim()) return;
                          await call(`/api/licenses/${key}/rename`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: editName }),
                          });
                          setEditKey(null);
                        }}
                      >
                        <input
                          autoFocus
                          value={editName}
                          maxLength={100}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === "Escape" && setEditKey(null)}
                          className="w-44 rounded-lg border border-[#2a2d36] bg-[#12141a] px-3 py-1.5 text-slate-100 outline-none focus:border-blue-400"
                        />
                        <button type="submit" disabled={busy} className={darkBtn}>บันทึก</button>
                        <button type="button" className={darkBtn} onClick={() => setEditKey(null)}>ยกเลิก</button>
                      </form>
                    ) : (
                      <span>
                        {l.name}{" "}
                        <button
                          className="ml-1 text-slate-400 hover:text-slate-100"
                          onClick={() => { setEditKey(key); setEditName(l.name); }}
                        >
                          แก้ไขชื่อ
                        </button>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs">
                    {key}{" "}
                    <button
                      className="ml-1 text-slate-400 hover:text-slate-100"
                      onClick={() => navigator.clipboard?.writeText(key)}
                    >
                      คัดลอก
                    </button>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-slate-400">
                    {l.machine_id ? l.machine_id.slice(0, 12) + "…" : "ยังไม่ผูก"}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs ${
                        l.active
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {l.active ? "ใช้งานอยู่" : "ปิดใช้งาน"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-slate-400">
                    {formatDateTime(new Date(l.created_at * 1000).toISOString())}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-2">
                      <button
                        disabled={busy}
                        className={darkBtn}
                        onClick={() => call(`/api/licenses/${key}/toggle`, { method: "POST" })}
                      >
                        {l.active ? "ปิด" : "เปิด"}
                      </button>
                      <button
                        disabled={busy || !l.machine_id}
                        className={darkBtn}
                        onClick={() => {
                          if (confirm(`ปลดเครื่องที่ผูกกับ "${l.name}" ออก?`))
                            call(`/api/licenses/${key}/reset`, { method: "POST" });
                        }}
                      >
                        ปลดเครื่อง
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && entries.length === 0 && !error && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    ยังไม่มี License
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
