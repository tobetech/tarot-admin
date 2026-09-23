import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * ทำงานกับทุก path ยกเว้นไฟล์ static และรูปภาพ เพื่อให้ตรวจ session ได้ครอบคลุม
     * แต่ไม่ไปหน่วงการโหลด asset
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
