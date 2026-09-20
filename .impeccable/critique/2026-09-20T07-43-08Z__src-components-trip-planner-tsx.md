---
target: /plan (trip-planner)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "file:C:\\Users\\tlstk\\Desktop\\ULTSPOT-claude\\src\\components\\trip-planner.tsx"
target_fingerprint: "sha256:e475173f672e1f39e246bb25bc9201a54956d1eea322bde60ad3d63db6a7deaf"
target_path: "C:\\Users\\tlstk\\Desktop\\ULTSPOT-claude\\src\\components\\trip-planner.tsx"
timestamp: 2026-09-20T07-43-08Z
slug: src-components-trip-planner-tsx
---
Method: dual-agent (A: design review · B: detector/browser evidence, isolated)

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3/4 | Step nav, live counts, role=status toasts strong; primary CTA disabled by default |
| 2 | Match system / real world | 2/4 | `Jonggak Line 1 5番出口` parses as "Line 15"; address romanized-only, nothing to show a taxi driver |
| 3 | User control and freedom | 3/4 | Back-navigable, editable from result; date-change clear has no undo |
| 4 | Consistency and standards | 2/4 | Japanese status badge sits beside English category on the same card |
| 5 | Error prevention | 3/4 | validateTrip gates steps, 6-cap, PII warning; artist picker commits to a choice that cannot succeed |
| 6 | Recognition rather than recall | 3/4 | Day summary repeats each step; artist selection hidden in closed details |
| 7 | Flexibility and efficiency | 2/4 | No reordering, no pinned anchor stop, no shareable URL |
| 8 | Aesthetic and minimalist design | 2/4 | ja/zh render up to 4 typefaces per paragraph; zh h1 has no brand font |
| 9 | Recognize, diagnose, recover | 3/4 | Best trait: every omission carries reason + next action; "check the source" has no link |
| 10 | Help and documentation | 3/4 | Per-card provenance + 생카 tips real; nothing explains why half the screen is English |
| **Total** | | **26/40** | all ten applicable |

Trend: 25 -> 29 -> 26. The score fell because assessed surface area grew: rounds 1-2 reviewed Korean only; round 3 reviewed ja/zh. The added surface was the least finished.

## Design Specificity Verdict

Authored at the copy layer, generic at the data and interaction layer.

Genuinely K-pop-authored: the 생일카페 first-timer tips (drink purchase, 11-12시 openings, cash lucky draws, 선착순 특전), stops rendered as トラック 01/02, "ソウル・セットリスト", member birthdays with birthday_checked_on and official-profile links, the vinyl Fan Day Pass.

Generic underneath: strip the nouns and the engine is date -> start/end -> two pace presets -> pick <=6 -> sorted timed list. `grep -c artistIds src/lib/trip/catalog.ts` returns 0 (verified). The one feature that makes this a fan tool is wired to a dataset that can never satisfy it.

**Deterministic scan**: source scan returned 0 findings, exit 0 — validated, not taken at face value. A positive control (bad CSS) returned 2 findings/exit 2; a deliberately a11y-broken .tsx returned 0, confirming source mode is regex-only. Browser mode on production returned 3: low-contrast 3.7:1 (#7c7266 on #1e1913), nested-cards, repeating-stripes-gradient (advisory).

All three are false positives or advisory, verified rather than assumed: the contrast pairs sit on a native `disabled` button (WCAG 1.4.3 exempts inactive controls); the nested cards are artist chips inside a CLOSED `<details>` (Chromium uses content-visibility:hidden, so they still return non-zero getBoundingClientRect — that is why a naive scanner sees them). No overlay badges this round.

The round's two P0s were caught by neither detector mode.

**Browser measurements (production):** zero horizontal overflow at 390px and 1440px across all 4 locales. Zero real contrast failures excluding disabled controls. One undersized touch target: the wordmark link, 93.7x25. Language select 101x44, first in tab order, keyboard-operable end to end, accessible name localized per locale. No skipped heading levels, but `/` has 2 headings total and `/plan` has 1 — section titles are labels, not headings. `<html lang>` correct in all 4 cases including zh-Hans.

Note: `<input type="time">` renders Korean AM/PM in every locale. A control on a blank page reproduced it under en-US and ja-JP Playwright contexts, so it is the test machine's browser UI language, NOT the application. Unconfirmable from here.

## What's Working

1. **The omission ledger** (trip-planner.tsx:346-351) names every spot that did not fit and why, in the user's language. It converts apparent failure into evidence the tool respected the constraint — users trust the scheduled stops more because of the rejected one.
2. **The 생일카페 tips block** is written by someone who has stood in the queue, and gives the caveat AND its scope, so the user knows how much to trust it.
3. **Korean typography is properly tuned** — `word-break: keep-all` yields 0 line-break violations on the ko build. The defect is only that it was never scoped.

## Priority Issues

### P0 — A Korean string is live in the Japanese UI, at the decision gate
messages.ja.ts:129 `pickFirst: "1か所以上선택してください"`. Verified: the ja dictionary contains exactly 3 Hangul runs — L8 (`한국어` option, correct), L70 (search placeholder, intentional), L129 (bug). zh is clean.
This is the instruction telling a Japanese visitor how to unlock the primary action, and one third is in the script they came here because they cannot read. Reads as "this build was never opened in Japanese."
Fix: `"1か所以上選んでください"` + a CI guard asserting no [가-힣] outside the `lang` block in ja/zh dictionaries.

### P0 — Korean-only typography rules applied globally, breaking ja/zh
globals.css:31-32 `word-break: keep-all; overflow-wrap: anywhere;` — correct for Korean, but makes every spaceless Japanese sentence one unbreakable unit, so every ja line break is an emergency break with no kinsoku. Verified on production: hero lead breaks `行きたいK-`/`POPスポット` (K-POP split mid-brand-name), line 3 opens with a lone `。`, step nav orphans single kana (`日程を決め`/`る`).
theme.css:140-142 names "Apple SD Gothic Neo", "Noto Sans KR" ahead of generic sans-serif, so every kana/hanzi Pretendard lacks falls through to a KOREAN face. CDP getPlatformFontsForNode on production: ja footer paragraph = 4 typefaces (Malgun Gothic 28 + Noto Sans KR 5 + Yu Gothic 2 + Pretendard 45); zh h1 = Microsoft YaHei 8, zero Unbounded, zero Pretendard. Because Noto Sans KR is named explicitly, this reproduces on any machine that has it.
Fix: scope both under :lang(). keep-all under :lang(ko) only, normal for ja/zh so the browser applies kinsoku; move the Korean faces out of the global --font-sans into :lang(ko), add :lang(ja) and :lang(zh-Hans) stacks.

### P1 — Translations that already exist are thrown away, and English source text is unexplained
spot-card.tsx:41 `const kind = (locale === "ko" && t.kinds[event.kind]) || event.kind;`. The ja and zh `kinds` blocks are fully translated (messages.ja.ts:138-143, messages.zh.ts:138-143) and never reached. `kind` is an ULTSPOT-authored taxonomy label, not source data — the mistranslation-risk rule does not apply, and the status badge beside it is already translated, so the card contradicts itself.
Separately, English source text carries no visible marker. The deliberate policy lives in code comments only. From the user's seat, "hours we won't risk mistranslating" and "we ran out of time" look identical — and the untranslated `kind` argues for the second reading.
Fix: (a) `const kind = t.kinds[event.kind] || event.kind;` (b) one visible line where English appears, turning the gap into the trust signal it was meant to be.

### P1 — The artist picker can only ever fail
No catalog entry carries artistIds (verified: 0 occurrences). Every artist selection produces the warning branch. There is no path that returns a positive result. This is the only thing separating ULTSPOT from a generic day planner, it is hidden behind a closed `<details>` labelled optional, and its sole possible outcome is disappointment. A judge will open it, because it is the differentiator.
Fix: tag the three catalog entries with the artists they plausibly serve, with the same provenance discipline as the rest of the data. If no tag can be sourced honestly in time, change the summary from "optional" to an honest scope statement so the user does not open a door onto a wall.

### P2 — Primary CTA's default state is near-illegible; language switcher lacks a visible affordance
`disabled:opacity-40` on the lime primary, which on step 1 is disabled BY DEFAULT, so the most important button makes its first impression at a computed 3.4:1. WCAG exempts disabled controls and the detector correctly flagged this as a false positive — but this is a default state, not an exceptional one. Regulation satisfied; user sees a broken button.
The language select measures flawlessly (44px, first tab stop, keyboard-operable, localized accessible name, visible focus ring). The gap is DISCOVERABILITY of the closed state: a reader of no Korean sees a pill reading `한국어` with a native chevron as the only cue.
Fix: a distinct disabled token instead of opacity; a globe glyph before the select.

## Persona Red Flags

**Mai, 26, Tokyo, reads no Korean** (production correctly serves `<html lang="ja">`): the instruction to unlock her plan is one third Korean; her first sentence breaks K-POP mid-name; step nav orphans single kana; the footer she is asked to trust is set in 4 typefaces; every spot title/area/category/description is English while Japanese category translations sit unused; the address for a taxi driver is romanized-only; `Jonggak Line 1 5番出口`; she picks Stray Kids and is told there are none. Every time.

**Wei, 22, Guangzhou, 390px**: her h1 renders in Microsoft YaHei — no Unbounded, no Pretendard; her subtitle mixes 4 faces including Noto Sans KR, so some hanzi arrive in Korean glyph forms; same untranslated categories. Her step-nav labels fit on one line by luck of character count (4), not by design.

**Korean judge, 1440px**: disabled olive CTA as first impression; 3-card grid leaves the lower half of the screen empty; "최대 6곳" against a catalog of 3; switches to 日本語 to test the headline feature of the last two commits and lands on the Korean string.

## Minor Observations

- Toast is `bottom-20` (80px); the step-1 sticky bar measures 129px, so a step-1 notice overlays the primary CTA (inferred from measurements, not directly observed)
- Wordmark link 93.7x25 — the only sub-44px target on the page
- Spot titles break with `·` opening line 2
- `event.address` is hardcoded lang="en" even on the Korean screen; whether naver map resolves a romanized string was NOT verified
- The Fan Day Pass decoration occupies ~900px on a 390px screen with ~250px empty below
- The 서울 vinyl is the largest brand element on step 0, in a script 3 of 4 audiences cannot read — defensible as atmosphere, but inherited rather than decided
- `artists.placeholder` is identical in ja and zh; probably intentional (demonstrating Korean-name search) but unexplained Hangul two lines above the actual bug
- matchLocale routes zh-TW/zh-HK to Simplified with a code comment acknowledging no Traditional build; a Taiwanese fan gets Simplified with no on-screen notice
- LocaleProvider switches language without reload and preserves in-progress form state — correct and often got wrong

## Questions to Consider

1. The honesty rule is enforced everywhere the user cannot see it and nowhere they can. If a Japanese visitor cannot tell deliberate English from an unfinished translation, what is the honesty buying?
2. Rounds 1 and 2 both shipped Korean typography rules that were correct when there was one locale. Adding three locales revisited neither. What else here is a correct Korean decision now silently applied to ja and zh?
3. The plan's closing sentence says four hours are empty. The real reason is a catalog of three. Which is more honest: silence about the cause, or naming it?
