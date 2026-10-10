// ฟังก์ชันจัดรูปแบบที่ใช้ร่วมกันในหน้า dashboard (เวลาไทย Asia/Bangkok ทั้งหมด)

export const THB = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const TZ = "Asia/Bangkok";

/** วันที่แบบ YYYY-MM-DD ตามเวลาไทย (ใช้จัดกลุ่มยอดขายรายวัน) */
export function bkkDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("sv-SE", { timeZone: TZ });
}

/** เช่น 8/10/2569 15:01:03 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    timeZone: TZ,
    hour12: false,
  });
}

/** เวลา 00:00 (เวลาไทย) ของวันที่ย้อนหลังไป days-1 วัน เป็น ISO สำหรับ query */
export function sinceStartOfDay(days: number): string {
  const today = bkkDate(new Date());
  const start = Date.parse(`${today}T00:00:00+07:00`) - (days - 1) * 86400000;
  return new Date(start).toISOString();
}

/** รายการวันที่ (YYYY-MM-DD) ตั้งแต่ since ถึง untilDate (ค่าเริ่มต้น = วันนี้) ตามเวลาไทย */
export function dayRange(sinceIso: string, untilDate?: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${untilDate ?? bkkDate(new Date())}T00:00:00+07:00`);
  let t = Date.parse(`${bkkDate(sinceIso)}T00:00:00+07:00`);
  while (t <= end) {
    out.push(bkkDate(new Date(t)));
    t += 86400000;
  }
  return out;
}

/** เริ่มต้นวัน YYYY-MM-DD (เวลาไทย) เป็น ISO */
export function startOfDateIso(date: string): string {
  return new Date(`${date}T00:00:00+07:00`).toISOString();
}

/** เริ่มต้นของ "วันถัดไป" ของวันที่ที่ให้ (ใช้เป็นขอบบนแบบ exclusive) */
export function nextDayIso(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00+07:00`) + 86400000).toISOString();
}
