import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tarot Admin Dashboard",
  description: "ระบบจัดการตู้ทำนายดวง - ยอดขาย ธุรกรรม และสถิติแบบ realtime",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-950">{children}</body>
    </html>
  );
}
