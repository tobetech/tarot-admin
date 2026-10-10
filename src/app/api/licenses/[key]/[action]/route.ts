import { gateway, requireUser } from "@/lib/license-api";

// action: reset = ปลดเครื่องที่ผูกไว้, rename = เปลี่ยนชื่อตู้, toggle = เปิด/ปิดการใช้งาน
export async function POST(
  req: Request,
  { params }: { params: Promise<{ key: string; action: string }> }
) {
  if (!(await requireUser())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { key, action } = await params;
  if (action !== "reset" && action !== "toggle" && action !== "rename") {
    return Response.json({ error: "bad action" }, { status: 400 });
  }
  if (!/^[A-Za-z0-9-]{1,64}$/.test(key)) {
    return Response.json({ error: "bad key" }, { status: 400 });
  }
  if (action === "rename") {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim().slice(0, 100);
    if (!name) return Response.json({ error: "กรุณาใส่ชื่อ" }, { status: 400 });
    return gateway(`/admin/licenses/${key}/rename`, { method: "POST", body: JSON.stringify({ name }) });
  }
  return gateway(`/admin/licenses/${key}/${action}`, { method: "POST" });
}
