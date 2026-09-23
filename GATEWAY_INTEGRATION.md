# วิธีต่อ gateway_server.py เข้ากับ Dashboard นี้

Dashboard อ่านข้อมูลจาก 2 ตารางใน Supabase: `tarot_machines` และ `tarot_transactions`
(โครงสร้างเต็มอยู่ใน `supabase/schema.sql`) — ฝั่ง `gateway_server.py` (เซิร์ฟเวอร์กลางที่
`server.py` ของตู้เรียกผ่าน `/v1/log-transaction` และ `/v1/cash-topup`) ต้องเป็นคน **เขียน**
แถวใหม่เข้าตารางนี้ทุกครั้งที่มีธุรกรรมเกิดขึ้นจริง ถึงจะขึ้นบน dashboard แบบ realtime

⚠️ **สำคัญ**: การเขียนข้อมูลต้องใช้ **service_role key** (ไม่ใช่ anon key) เพราะตั้ง Row Level
Security ไว้ให้เฉพาะผู้ที่ login แล้วเท่านั้นที่ "อ่าน" ได้ ส่วนการ "เขียน" ต้องใช้ key ที่มีสิทธิ์
ข้าม RLS ได้ (service_role) — **ห้ามเอา service_role key ไปใส่ในตู้ (server.py) หรือฝั่ง
frontend เด็ดขาด** เพราะเป็นคีย์สิทธิ์สูงสุด ให้เก็บไว้ใน `gateway_server.py` ที่รันบนเซิร์ฟเวอร์
ของคุณเองเท่านั้น (เหมือนกับที่เก็บ ANTHROPIC_API_KEY / KSHER key อยู่แล้ว)

หา service_role key ได้ที่ Supabase Dashboard → Project Settings → API → `service_role`
`secret`

## ติดตั้ง

```bash
pip install supabase
```

## ตัวอย่างโค้ดที่ต้องเพิ่มใน gateway_server.py

```python
import os
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]                # เช่น https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def ensure_machine_registered(machine_id: str):
    """เรียกครั้งแรกที่เจอ machine_id ใหม่ - upsert เข้าตาราง machines
    (กันไว้เผื่อ transactions.machine_id อ้างถึง machine_id ที่ยังไม่เคยลงทะเบียน
    เพราะตั้ง foreign key ไว้)"""
    supabase.table("tarot_machines").upsert({
        "machine_id": machine_id,
        "last_seen_at": "now()",
    }).execute()


def log_topup(machine_id: str, payment_method: str, amount: float, lang: str):
    """เรียกตอนรับเงินสำเร็จ (ทั้งเงินสดจาก bill_acceptor.py และ QR ที่จ่ายแล้ว)
    payment_method: "cash" หรือ "qr" """
    ensure_machine_registered(machine_id)
    supabase.table("tarot_transactions").insert({
        "machine_id": machine_id,
        "kind": "topup",
        "payment_method": payment_method,
        "amount": amount,
        "credits": 1,          # ปรับสูตรคำนวณเครดิตต่อจำนวนเงินตามจริงของคุณ
        "language": lang,
        "status": "completed",
    }).execute()


def log_reading(machine_id: str, lang: str):
    """เรียกตอนลูกค้ากด 'เริ่มทำนายดวง' จริง (ใช้เครดิต 1 หน่วย)
    ตรงกับ endpoint /v1/log-transaction ที่ server.py ของตู้เรียกอยู่แล้ว"""
    ensure_machine_registered(machine_id)
    supabase.table("tarot_transactions").insert({
        "machine_id": machine_id,
        "kind": "reading",
        "credits": 1,
        "language": lang,
        "status": "completed",
    }).execute()
```

## จุดที่ต้องแก้ใน endpoint เดิมของ gateway_server.py

- `/v1/cash-topup` — เรียก `log_topup(machine_id, "cash", amount, lang)` โดย `amount` มาจาก
  field `amount` ที่ `server.py` ของตู้ส่งมาแล้ว (แก้ไว้ให้แล้วตามที่คุยกันก่อนหน้านี้ในเรื่อง
  bill acceptor)
- `/v1/qr-payment/status/<order_id>` — ตอนเช็คแล้วพบว่า **จ่ายเงินสำเร็จ** (status เปลี่ยนเป็น
  paid) ให้เรียก `log_topup(machine_id, "qr", amount, lang)` ตรงจุดนั้น (แค่ครั้งเดียวตอนเพิ่ง
  จ่ายสำเร็จ ไม่ใช่ทุกครั้งที่ frontend poll เช็คสถานะ)
- `/v1/log-transaction` — เรียก `log_reading(machine_id, lang)`

ถ้าส่งไฟล์ `gateway_server.py` มาให้ดู ผมช่วยแก้จุดที่แน่นอนให้ตรงกับโค้ดจริงได้เลยครับ
