// NEXT_PUBLIC_ 값은 빌드 시점에 문자열로 치환되므로 process.env.X 형태로 직접 참조해야 한다
// (process.env[key] 같은 동적 접근은 브라우저 번들에서 undefined가 된다).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** 키가 없는 로컬·프리뷰 환경에서도 앱이 뜨도록, 호출부는 이 값을 먼저 확인한다. */
export const isSupabaseConfigured = Boolean(url && publishableKey);

export function getSupabaseEnv() {
  if (!url || !publishableKey) {
    throw new Error(
      "Supabase 환경 변수가 없습니다. .env.example을 복사해 .env.local에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 채워주세요.",
    );
  }
  return { url, publishableKey };
}
