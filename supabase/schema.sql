-- ============================================================================
-- Tarot / BaZi Kiosk - Supabase Schema
-- ============================================================================
-- รันไฟล์นี้ใน Supabase Dashboard -> SQL Editor -> New query -> วางแล้วกด Run
-- (หรือใช้ Supabase CLI: supabase db push)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ตาราง machines - ทะเบียนตู้ที่มีอยู่ทั้งหมด
-- ----------------------------------------------------------------------------
create table if not exists public.tarot_machines (
  machine_id text primary key,           -- ตรงกับ MACHINE_ID ใน server.py ของแต่ละตู้ (เช่น "bazi-xxxxxxxx")
  name text not null default 'ตู้ไม่มีชื่อ',
  location text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.tarot_machines is 'ทะเบียนตู้คีออสก์ทั้งหมดที่เชื่อมต่อระบบ';

-- ----------------------------------------------------------------------------
-- 2. ตาราง transactions - ทุกธุรกรรม (ทั้งการหยอดเงิน และการเริ่มทำนายที่ใช้เครดิต)
-- ----------------------------------------------------------------------------
create table if not exists public.tarot_transactions (
  id uuid primary key default gen_random_uuid(),
  machine_id text not null references public.tarot_machines(machine_id) on delete cascade,

  -- ประเภทธุรกรรม: 'topup' = รับเงินเข้า (เหรียญ/แบงก์/QR), 'reading' = ลูกค้าเริ่มทำนาย (ใช้เครดิต)
  kind text not null check (kind in ('topup', 'reading')),

  -- ช่องทางชำระเงิน: ใช้เฉพาะตอน kind = 'topup'
  payment_method text check (payment_method in ('cash', 'qr')),

  -- จำนวนเงิน (บาท) - ใช้เฉพาะตอน kind = 'topup'
  amount numeric(10, 2),

  -- จำนวนเครดิตที่เพิ่ม/ใช้ในธุรกรรมนี้
  credits numeric(10, 2) not null default 1,

  -- ภาษาที่ลูกค้าเลือกอยู่ตอนทำธุรกรรมนี้
  language text check (language in ('th', 'en', 'my', 'zh', 'km', 'lo')),

  -- สถานะ (เผื่อ QR ที่ยังรอชำระ/หมดเวลา/ชำระสำเร็จ)
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed', 'expired')),

  -- เลขอ้างอิงคำสั่งซื้อ QR (Ksher order_id) - null ถ้าไม่ใช่ QR
  qr_order_id text,

  created_at timestamptz not null default now()
);

comment on table public.tarot_transactions is 'บันทึกทุกธุรกรรมของตู้: การรับเงิน (topup) และการเริ่มทำนาย (reading)';

create index if not exists idx_tarot_transactions_created_at on public.tarot_transactions (created_at desc);
create index if not exists idx_tarot_transactions_machine_id on public.tarot_transactions (machine_id);
create index if not exists idx_tarot_transactions_payment_method on public.tarot_transactions (payment_method);
create index if not exists idx_tarot_transactions_language on public.tarot_transactions (language);

-- ----------------------------------------------------------------------------
-- 3. เปิด Row Level Security + policy: อนุญาตเฉพาะผู้ที่ login แล้ว (authenticated) เท่านั้น
--    ที่จะ "อ่าน" ข้อมูลได้ ส่วนการ "เขียน" ข้อมูลจากตู้ ให้ gateway_server.py ใช้
--    service_role key เขียนเข้ามา (service_role ข้าม RLS ได้อยู่แล้วโดยไม่ต้องมี policy เพิ่ม)
-- ----------------------------------------------------------------------------
alter table public.tarot_machines enable row level security;
alter table public.tarot_transactions enable row level security;

drop policy if exists "Authenticated users can read tarot_machines" on public.tarot_machines;
create policy "Authenticated users can read tarot_machines"
  on public.tarot_machines for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read tarot_transactions" on public.tarot_transactions;
create policy "Authenticated users can read tarot_transactions"
  on public.tarot_transactions for select
  to authenticated
  using (true);

-- ----------------------------------------------------------------------------
-- 4. เปิด Realtime สำหรับตาราง transactions (ให้ dashboard subscribe แบบ live ได้)
--    ไปที่ Database -> Replication -> เปิด toggle สำหรับตาราง transactions ด้วย (ถ้าคำสั่งนี้ไม่ทำงาน)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'tarot_transactions'
  ) then
    alter publication supabase_realtime add table public.tarot_transactions;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 5. ตัวอย่างข้อมูลทดสอบ (ลบทิ้งได้ถ้าไม่ต้องการ) - ช่วยให้เห็น dashboard มีข้อมูลตั้งแต่แรก
-- ----------------------------------------------------------------------------
insert into public.tarot_machines (machine_id, name, location)
values ('demo-machine-001', 'ตู้ทดสอบ (Demo)', 'สำนักงาน')
on conflict (machine_id) do nothing;

insert into public.tarot_transactions (machine_id, kind, payment_method, amount, credits, language, status)
values
  ('demo-machine-001', 'topup', 'cash', 20, 1, 'th', 'completed'),
  ('demo-machine-001', 'reading', null, null, 1, 'th', 'completed'),
  ('demo-machine-001', 'topup', 'qr', 20, 1, 'en', 'completed'),
  ('demo-machine-001', 'reading', null, null, 1, 'en', 'completed')
on conflict do nothing;
