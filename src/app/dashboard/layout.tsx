// หน้า dashboard ไม่มีแถบเมนูด้านบน (ปุ่ม รีเฟรช / ออกจากระบบ อยู่ใน DashboardClient)
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0b0d12]">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
