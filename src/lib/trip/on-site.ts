import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * 현장 현황 공유와 포인트. **서버에 남는 유일한 팬 기록이다.**
 *
 * 왜 서버인가: 대기 정도·특전 잔여는 다른 팬에게 보여주려고 모으는 값이다. 브라우저에만
 * 두면 집계가 성립하지 않는다. 반대로 체크인·가계부·발자취는 혼자 보는 기록이라
 * 기기 저장 그대로 두었다 — 이 파일은 그것들을 대체하지 않는다.
 *
 * 권한은 전부 DB가 정한다 (`supabase/migrations/202609200002_on_site_records.sql`).
 * 포인트는 `point_ledger`에 직접 쓸 수 없고 함수만이 쓴다. 클라이언트가 점수를 고를 수 없다.
 * 여기서는 함수를 부르고 오류 문구를 화면 언어로 옮기는 일만 한다.
 *
 * 익명 로그인은 **절대 조용히 하지 않는다.** 호출부가 먼저 동의 모달을 띄우고, 사용자가
 * 확인한 뒤에만 `ensureGuest`를 부른다. 게스트 계정이 생기는 것은 사용자가 아는 일이어야 한다.
 */

export const onSiteEnabled = isSupabaseConfigured
  && process.env.NEXT_PUBLIC_ENABLE_CLOUD_TRIPS === "true";

/** DB의 check 제약과 같은 값. 순서가 화면 순서다. */
export const waitingLevels = ["none", "short", "medium", "long"] as const;
export const perkLevels = ["plenty", "few", "none", "unknown"] as const;
export type WaitingLevel = (typeof waitingLevels)[number];
export type PerkLevel = (typeof perkLevels)[number];

export const UNLOCK_COST = 30;

export type PlaceStatus = {
  placeId: string;
  /** 다녀왔거나 포인트로 열었으면 true. false면 집계를 볼 수 없다. */
  openToMe: boolean;
  waiting: WaitingLevel | null;
  perks: PerkLevel | null;
  /** 최근 2일치 보고 수. 0이면 아직 아무도 남기지 않았다. */
  reports: number;
};

export class OnSiteError extends Error {}

/** 이미 로그인돼 있으면 그 세션을, 없으면 null. 계정을 만들지 않는다. */
export async function currentGuest(): Promise<string | null> {
  if (!onSiteEnabled) return null;
  const { data, error } = await createClient().auth.getSession();
  if (error) return null;
  return data.session?.user.id ?? null;
}

/**
 * 게스트 세션을 보장한다. **사용자가 동의 모달에서 확인한 뒤에만 부른다.**
 * 이미 세션이 있으면 새로 만들지 않는다.
 */
export async function ensureGuest(): Promise<string> {
  if (!onSiteEnabled) throw new OnSiteError("disabled");
  const client = createClient();
  const { data: sessionData } = await client.auth.getSession();
  if (sessionData.session?.user) return sessionData.session.user.id;
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) throw new OnSiteError("signInFailed");
  return data.user.id;
}

/**
 * DB가 올린 예외를 화면이 분기할 수 있는 코드로 바꾼다.
 * 원문을 그대로 보여주지 않는다 — 영어이고, 사용자가 고칠 수 없는 내부 사정이 섞인다.
 */
function toCode(message: string): string {
  if (/already open to you/i.test(message)) return "alreadyOpen";
  if (/checked in here/i.test(message)) return "alreadyVisited";
  if (/need .* more points/i.test(message)) return "notEnoughPoints";
  if (/Sign in/i.test(message)) return "signInFailed";
  return "failed";
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await createClient().rpc(name, args);
  if (error) throw new OnSiteError(toCode(error.message));
  return data as T;
}

/** 현장 현황을 남긴다. 같은 장소·같은 날 다시 내면 내용만 바뀌고 포인트는 더 주지 않는다. */
export async function reportStatus(placeId: string, waiting: WaitingLevel, perks: PerkLevel) {
  const rows = await rpc<{ points_awarded: number; balance: number }[]>("record_status_report", {
    target_place_id: placeId, waiting_level: waiting, perk_level: perks,
  });
  const row = rows?.[0];
  if (!row) throw new OnSiteError("failed");
  return { awarded: row.points_awarded, balance: row.balance };
}

/** 방문을 서버에도 남기고 포인트를 받는다. 기기 저장 체크인과 별개이며 선택이다. */
export async function recordVisit(placeId: string) {
  const rows = await rpc<{ checked_in_on: string; points_awarded: number; balance: number }[]>("record_checkin", {
    target_place_id: placeId, checkin_source: "manual", measured_distance_m: null,
  });
  const row = rows?.[0];
  if (!row) throw new OnSiteError("failed");
  return { on: row.checked_in_on, awarded: row.points_awarded, balance: row.balance };
}

/** 다녀오지 않은 곳의 집계를 포인트로 연다. 다녀온 곳은 애초에 열려 있다. */
export async function unlockPlace(placeId: string) {
  return { balance: await rpc<number>("unlock_place", { target_place_id: placeId }) };
}

/** 한 번에 1~50곳. 열리지 않은 곳도 행은 오되 집계가 비어 있다. */
export async function placeStatuses(placeIds: string[]): Promise<PlaceStatus[]> {
  const ids = [...new Set(placeIds)].slice(0, 50);
  if (!ids.length) return [];
  const rows = await rpc<{ place_id: string; open_to_me: boolean; waiting: string | null; perks: string | null; reports: number }[]>(
    "place_status_summary", { place_ids: ids });
  return (rows ?? []).map(r => ({
    placeId: r.place_id,
    openToMe: r.open_to_me,
    waiting: (waitingLevels as readonly string[]).includes(r.waiting ?? "") ? r.waiting as WaitingLevel : null,
    perks: (perkLevels as readonly string[]).includes(r.perks ?? "") ? r.perks as PerkLevel : null,
    reports: r.reports ?? 0,
  }));
}

/** 내 포인트 잔액. 원장은 읽기만 가능하다. */
export async function pointBalance(): Promise<number> {
  const { data, error } = await createClient().from("point_ledger").select("points");
  if (error) throw new OnSiteError("failed");
  return (data ?? []).reduce((sum, row: { points: number }) => sum + row.points, 0);
}
