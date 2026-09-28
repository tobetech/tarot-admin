"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// แท็บสลับระหว่างตู้แต่ละประเภท - เพิ่มตู้ใหม่ในอนาคตได้ที่ TABS ตัวเดียว
const TABS = [
  { href: "/dashboard", label: "ไพ่ยิปซี", icon: "🔮" },
  { href: "/dashboard/seiza", label: "เซซะอุราไน", icon: "✨" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto flex max-w-7xl gap-1 px-4 sm:px-6">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition ${
              active
                ? "border-amber-500 text-slate-100"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
