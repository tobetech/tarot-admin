import { gateway, requireUser } from "@/lib/license-api";

export async function GET() {
  if (!(await requireUser())) return Response.json({ error: "unauthorized" }, { status: 401 });
  return gateway("/admin/licenses");
}

export async function POST(request: Request) {
  if (!(await requireUser())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim().slice(0, 100) || "ไม่ระบุชื่อ";
  return gateway("/admin/licenses", { method: "POST", body: JSON.stringify({ name }) });
}
