import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

/**
 * 만료된 access token을 요청 앞단에서 갱신해 쿠키에 다시 써준다.
 * Server Component는 쿠키를 쓸 수 없어서, 이 단계가 없으면 토큰 만료 시 사용자가 무작위로 로그아웃된다.
 */
export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // 갱신된 세션 쿠키가 CDN에 캐시돼 다른 사용자에게 나가지 않도록 라이브러리가 주는 캐시 헤더를 붙인다.
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // createServerClient와 이 호출 사이에 다른 코드를 넣지 않는다 — 세션 갱신이 누락될 수 있다.
  await supabase.auth.getClaims();

  return response;
}
