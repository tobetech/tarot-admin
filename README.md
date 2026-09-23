# Tarot Admin Dashboard

Dashboard สำหรับจัดการตู้ทำนายดวง — ดูยอดขาย, ธุรกรรมแบบ realtime, แยกช่องทางชำระเงิน
(เงินสด/QR Code), และสัดส่วนภาษาที่ลูกค้าเลือกใช้ พัฒนาด้วย **Next.js (Node.js) +
Supabase + Tailwind CSS**, responsive ใช้ได้ทั้งจอคอม/แท็บเล็ต/มือถือ

## สิ่งที่ทำไว้ให้แล้ว

- ระบบ login ด้วย Supabase Auth (อีเมล/รหัสผ่าน) — เข้าหน้า `/dashboard` ไม่ได้ถ้ายังไม่ login
- หน้า dashboard: การ์ดสรุปยอดขายวันนี้ / จำนวนครั้งที่ทำนาย / แยกเงินสด-QR, กราฟยอดขาย
  7 วันล่าสุด, กราฟสัดส่วนช่องทางชำระเงินและภาษา, ตารางธุรกรรมล่าสุดที่อัปเดตแบบ realtime
  (ไม่ต้อง refresh หน้า)
- ตัวกรองดูข้อมูลแยกตามตู้ (รองรับหลายตู้ในระบบเดียว)
- SQL schema พร้อมใช้ (`supabase/schema.sql`)

## ขั้นตอนติดตั้ง (ทำตามลำดับ)

### 1. สร้างตารางใน Supabase

1. เข้า [supabase.com](https://supabase.com) → เปิดโปรเจกต์ของคุณ (หรือสร้างใหม่)
2. ไปที่ **SQL Editor** → New query
3. เปิดไฟล์ `supabase/schema.sql` ในโปรเจกต์นี้ → copy ทั้งหมด → วาง → กด **Run**
4. ไปที่ **Database → Replication** เช็คว่าตาราง `tarot_transactions` เปิด Realtime แล้ว
   (สคริปต์ข้างบนพยายามเปิดให้อัตโนมัติ แต่บาง project ต้องกดยืนยันเองอีกที)

### 2. สร้างบัญชี admin สำหรับ login

1. ไปที่ **Authentication → Users → Add user**
2. ใส่อีเมล + รหัสผ่านของ admin (เพิ่มได้หลายคน)

### 3. ตั้งค่า environment variables

1. ไปที่ **Project Settings → API** ใน Supabase คัดลอก **Project URL** และ **anon public key**
2. คัดลอกไฟล์ `.env.local.example` เป็น `.env.local` แล้วใส่ค่าที่ได้:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

### 4. รันทดสอบในเครื่องตัวเอง (ไม่บังคับ แต่แนะนำก่อน deploy จริง)

```bash
npm install
npm run dev
```

เปิด http://localhost:3000 → ควรเด้งไปหน้า `/login` → login ด้วย user ที่สร้างไว้ข้อ 2
→ ควรเห็นข้อมูลตัวอย่าง (demo data) ที่ schema.sql ใส่ไว้ให้แล้ว

### 5. Push ขึ้น GitHub

```bash
git init   # ถ้ายังไม่ได้ init (โปรเจกต์นี้ init ไว้ให้แล้ว)
git remote add origin https://github.com/tobetech/tarot-admin.git
git add .
git commit -m "Initial dashboard"
git branch -M main
git push -u origin main
```

### 6. Deploy บน Vercel

1. เข้า [vercel.com](https://vercel.com) → **Add New → Project** → เลือก repo
   `tobetech/tarot-admin`
2. ตอนตั้งค่าโปรเจกต์ ใส่ **Environment Variables** (อันเดียวกับข้อ 3):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. กด **Deploy**
4. ตั้งค่า custom domain ที่มีอยู่แล้ว: ไปที่ **Project → Settings → Domains** →
   เพิ่มโดเมนของคุณ แล้วตั้งค่า DNS ตามที่ Vercel บอก (โดยทั่วไปคือเพิ่ม CNAME record
   ชี้ไปที่ `cname.vercel-dns.com`)

## จุดสำคัญ: ต้องแก้ `gateway_server.py` ให้เขียนข้อมูลเข้า Supabase ด้วย

Dashboard นี้ **อ่าน** ข้อมูลจากตาราง `tarot_transactions`/`tarot_machines` เท่านั้น — ตัวที่ต้อง
**เขียน** ข้อมูลเข้าไปคือ `gateway_server.py` (เซิร์ฟเวอร์กลางที่รันแยกอยู่ ตามที่เห็นใน
`server.py` ของตู้ที่เรียก `/v1/log-transaction` และ `/v1/cash-topup`)

อ่านรายละเอียดวิธีแก้ต่อได้ในไฟล์ `GATEWAY_INTEGRATION.md`

## โครงสร้างโปรเจกต์

```
src/
  app/
    login/            หน้า login + server action
    dashboard/         หน้า dashboard หลัก (protected)
    auth/logout/        route สำหรับออกจากระบบ
  components/
    DashboardClient.tsx  ตัวหลัก: stat cards + charts + realtime feed
    StatCard.tsx
    RevenueChart.tsx
    BreakdownChart.tsx
  lib/
    supabase/           supabase client (browser/server/middleware)
    types.ts            TypeScript types ให้ตรงกับ schema
supabase/
  schema.sql            SQL สร้างตาราง + RLS + realtime
```
