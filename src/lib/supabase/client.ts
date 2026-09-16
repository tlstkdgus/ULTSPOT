import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

/** Client Component 전용. 세션은 쿠키에 저장돼 서버 클라이언트와 공유된다. */
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
