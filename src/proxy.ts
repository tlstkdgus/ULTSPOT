import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16부터 middleware.ts → proxy.ts
export async function proxy(request: NextRequest) {
  // Public planning never depends on auth availability; optional cloud save authenticates separately.
  // /api/travel은 좌표만 받아 이동시간을 돌려주는 공개 조회라 세션이 필요 없다.
  if (["/", "/plan", "/api/travel"].includes(request.nextUrl.pathname)) return NextResponse.next();
  if (!isSupabaseConfigured) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  // 정적 파일·이미지·폰트에는 세션 갱신이 필요 없다.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|woff2?)$).*)"],
};
