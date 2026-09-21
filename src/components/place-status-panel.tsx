"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n/locale";
import { GuestConsent } from "@/components/guest-consent";
import {
  currentGuest, ensureGuest, onSiteEnabled, perkLevels, placeStatuses, pointBalance,
  recordVisit, reportStatus, unlockPlace, UNLOCK_COST, waitingLevels,
  OnSiteError, type PerkLevel, type PlaceStatus, type WaitingLevel,
} from "@/lib/trip/on-site";

/**
 * 현장 현황. 이 화면에서 **유일하게 서버로 나가는** 부분이다.
 *
 * 나머지(체크인·가계부·발자취)는 기기 저장 그대로다. 여기만 서버인 이유는 대기 정도와 특전
 * 잔여가 다른 팬에게 보여주려고 모으는 값이라서다 — 브라우저에만 두면 집계가 성립하지 않는다.
 *
 * 게스트 기록이 없으면 아무 요청도 보내지 않는다. 먼저 동의 모달을 띄우고, 확인한 뒤에만
 * 익명 계정을 만든다. 취소하면 화면은 그대로다.
 *
 * 포인트·해제 가격·중복 방지는 전부 DB가 정한다. 여기서 점수를 계산하지 않는다.
 */
export function PlaceStatusPanel({ placeIds, placeName, notice }: {
  /** 이 날에 배치된 장소들. 1~50곳까지 한 번에 묻는다. */
  placeIds: string[];
  placeName: (placeId: string) => string;
  notice: (message: string) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const [guest, setGuest] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<PlaceStatus[]>([]);
  const [balance, setBalance] = useState(0);
  const [busy, setBusy] = useState(false);
  /** 동의 모달이 확인되면 실행할 일. 취소하면 버린다. */
  const [pending, setPending] = useState<(() => Promise<void>) | null>(null);
  const [target, setTarget] = useState(placeIds[0] ?? "");
  const [waiting, setWaiting] = useState<WaitingLevel>("short");
  const [perks, setPerks] = useState<PerkLevel>("unknown");

  const message = useCallback((error: unknown) => {
    const code = error instanceof OnSiteError ? error.message : "failed";
    const table = t.onSite.errors as Record<string, string>;
    notice(table[code] ?? t.onSite.errors.failed);
  }, [notice, t]);

  const refresh = useCallback(async (uid: string | null) => {
    if (!uid || !placeIds.length) { setStatuses([]); return; }
    try {
      const [rows, points] = await Promise.all([placeStatuses(placeIds), pointBalance()]);
      setStatuses(rows);
      setBalance(points);
    } catch (error) { message(error); }
  }, [placeIds, message]);

  // 이미 게스트 세션이 있으면 집계를 불러온다. 없으면 계정을 만들지 않고 그대로 둔다.
  useEffect(() => {
    let alive = true;
    void currentGuest().then(uid => {
      if (!alive) return;
      setGuest(uid);
      void refresh(uid);
    });
    return () => { alive = false; };
  }, [refresh]);

  /** 게스트가 있으면 바로, 없으면 동의를 먼저 받는다. */
  const withGuest = (work: () => Promise<void>) => {
    if (!onSiteEnabled) { notice(t.onSite.errors.disabled); return; }
    if (guest) { void run(work); return; }
    setPending(() => work);
  };

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try { await work(); } catch (error) { message(error); } finally { setBusy(false); }
  };

  const confirmConsent = async () => {
    const work = pending;
    setPending(null);
    if (!work) return;
    await run(async () => {
      const uid = await ensureGuest();
      setGuest(uid);
      await work();
      await refresh(uid);
    });
  };

  const submitReport = () => withGuest(async () => {
    if (!target) return;
    const { awarded, balance: next } = await reportStatus(target, waiting, perks);
    setBalance(next);
    notice(awarded > 0 ? t.onSite.awarded(awarded) : t.onSite.noAward);
    await refresh(guest ?? await currentGuest());
  });

  const addVisit = (placeId: string) => withGuest(async () => {
    const { awarded, balance: next } = await recordVisit(placeId);
    setBalance(next);
    notice(awarded > 0 ? t.onSite.awarded(awarded) : t.onSite.noAward);
    await refresh(guest ?? await currentGuest());
  });

  const open = (placeId: string) => withGuest(async () => {
    const { balance: next } = await unlockPlace(placeId);
    setBalance(next);
    await refresh(guest ?? await currentGuest());
  });

  if (!onSiteEnabled) {
    return (
      <section aria-label={t.onSite.legend} className="mt-4 rounded-xl border border-line-strong p-4">
        <h2 className="text-label">{t.onSite.legend}</h2>
        <p className="mt-1 text-caption text-text-muted">{t.onSite.disabled}</p>
      </section>
    );
  }

  const statusOf = (placeId: string) => statuses.find(s => s.placeId === placeId);

  return (
    <section aria-label={t.onSite.legend} className="mt-4 rounded-xl border border-line-strong p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-label">{t.onSite.legend}</h2>
        {guest && <span role="status" className="text-caption text-text">{t.onSite.balance(balance)}</span>}
      </div>
      <p className="mt-1 text-caption text-text-muted">{t.onSite.lead}</p>

      {/* 현황 남기기 */}
      <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-line-strong pt-3">
        <label className="text-caption text-text-muted" htmlFor={`${id}-place`}>{t.onSite.placeLabel}
          <select id={`${id}-place`} aria-label={t.onSite.placeLabel} value={target} onChange={event => setTarget(event.target.value)}
            className="mt-1 block min-h-11 max-w-56 truncate rounded-sm border border-line-strong bg-bg px-2 text-body-sm">
            {placeIds.map(pid => <option key={pid} value={pid}>{placeName(pid)}</option>)}
          </select>
        </label>
        <label className="text-caption text-text-muted" htmlFor={`${id}-waiting`}>{t.onSite.waitingLabel}
          <select id={`${id}-waiting`} aria-label={t.onSite.waitingLabel} value={waiting} onChange={event => setWaiting(event.target.value as WaitingLevel)}
            className="mt-1 block min-h-11 rounded-sm border border-line-strong bg-bg px-2 text-body-sm">
            {waitingLevels.map(level => <option key={level} value={level}>{t.onSite.waiting[level]}</option>)}
          </select>
        </label>
        <label className="text-caption text-text-muted" htmlFor={`${id}-perks`}>{t.onSite.perksLabel}
          <select id={`${id}-perks`} aria-label={t.onSite.perksLabel} value={perks} onChange={event => setPerks(event.target.value as PerkLevel)}
            className="mt-1 block min-h-11 rounded-sm border border-line-strong bg-bg px-2 text-body-sm">
            {perkLevels.map(level => <option key={level} value={level}>{t.onSite.perks[level]}</option>)}
          </select>
        </label>
        <Button size="sm" disabled={busy || !target} onClick={submitReport}>{t.onSite.submit}</Button>
      </div>

      {/* 장소별 집계 */}
      <ul className="mt-3 grid gap-2">
        {placeIds.map(pid => {
          const status = statusOf(pid);
          return (
            <li key={pid} className="rounded-sm border border-line-strong p-3">
              <p className="truncate text-body-sm">{placeName(pid)}</p>
              {!guest ? <p className="mt-1 text-caption text-text-faint">{t.onSite.lockedNote}</p>
                : status?.openToMe ? (
                  <>
                    <p className="mt-1 text-caption text-text-muted">
                      {status.reports > 0
                        ? <>{t.onSite.waitingLabel}: {status.waiting ? t.onSite.waiting[status.waiting] : "—"}
                          {" · "}{t.onSite.perksLabel}: {status.perks ? t.onSite.perks[status.perks] : "—"}
                          {" · "}{t.onSite.reports(status.reports)}</>
                        : t.onSite.noReports}
                    </p>
                    <p className="mt-1 text-caption text-text-faint">{t.onSite.openBecauseVisited}</p>
                  </>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="ghost" disabled={busy || balance < UNLOCK_COST}
                      onClick={() => open(pid)}>{t.onSite.unlock(UNLOCK_COST)}</Button>
                    <Button size="sm" variant="ghost" disabled={busy}
                      onClick={() => addVisit(pid)}>{t.onSite.recordVisit}</Button>
                    <span className="text-caption text-text-faint">{t.onSite.lockedNote}</span>
                  </div>
                )}
            </li>
          );
        })}
      </ul>
      {/* 이 안내는 "서버에도 기록" 버튼 설명이다. 게스트가 없으면 그 버튼이 없어 뜬금없다. */}
      {guest && <p className="mt-2 text-caption text-text-faint">{t.onSite.recordVisitNote}</p>}

      <GuestConsent open={pending !== null} onConfirm={confirmConsent} onCancel={() => setPending(null)} />
    </section>
  );
}
