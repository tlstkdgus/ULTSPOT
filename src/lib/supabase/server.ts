import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

/**
 * Server Component · Server Action · Route Handler 용.
 * 요청마다 새로 만든다 — 모듈 전역에 두면 다른 사용자의 쿠키가 섞인다.
 */
export async function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component에서는 쿠키를 쓸 수 없어 여기로 온다.
          // 세션 갱신은 src/proxy.ts가 매 요청 앞단에서 처리하므로 무시해도 된다.
        }
      },
    },
  });
}
