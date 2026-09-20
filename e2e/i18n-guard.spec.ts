import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { messages } from "../src/i18n/messages";

const { en, ko, ja, zh } = messages;

const HANGUL = /[가-힣]/;
const KANA = /[぀-ヿ]/;

/**
 * 일본어 사전에 "1か所以上선택してください"가 배포까지 나간 적이 있다. 주 버튼을 풀려면
 * 뭘 해야 하는지 알려주는 문장인데, 그 3분의 1이 방문자가 읽을 수 없는 문자였다.
 * 눈으로는 안 잡힌다 — 일본어 사전 한가운데 한글 두 글자라 훑으면 지나간다.
 *
 * `lang` 블록은 예외다. 언어 선택지는 그 언어 자체로 적어야 어느 화면에서도 읽힌다.
 */
function leaks(dict: Record<string, unknown>, pattern: RegExp) {
  const found: string[] = [];
  const walk = (node: unknown, path: string) => {
    if (typeof node === "string") {
      if (pattern.test(node)) found.push(`${path}: ${node}`);
      return;
    }
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (path === "" && k === "lang") continue; // 언어 선택지는 그 언어로 적는다
        walk(v, path ? `${path}.${k}` : k);
      }
    }
  };
  walk(dict, "");
  return found;
}

test("일본어·중국어 UI 문구에 한글이 섞이지 않는다 @static", () => {
  // 3회차에서 artists.placeholder("Stray Kids、필릭스…")를 "검색 예시라 의도된 한글"로 예외 처리했다가
  // 4회차 critique에서 다시 잡혔다. 일본어 독자에게는 첫 단계 첫 입력칸의 한글일 뿐이다.
  // 예외 없이 막는다. 검색 예시는 라틴 이름(Felix)으로도 충분하다.
  expect(leaks(ja, HANGUL)).toEqual([]);
  expect(leaks(zh, HANGUL)).toEqual([]);
});

test("한국어·영어 UI 문구에 가나가 섞이지 않는다 @static", () => {
  expect(leaks(ko, KANA)).toEqual([]);
  expect(leaks(en, KANA)).toEqual([]);
});

/**
 * `kinds`와 `lib`는 영어 원문을 키로 받는 번역표라, 원본 언어인 영어에서는 비어 있는 것이 맞다.
 * 그래서 구조 비교의 기준은 영어가 아니라 한국어다. 번역된 세 사전은 서로 같아야 한다 —
 * 한쪽에만 있는 키는 그 언어에서만 화면이 영어로 떨어진다는 뜻이고, 눈으로는 안 잡힌다.
 */
test("번역된 세 사전의 키 구조가 같다 @static", () => {
  const shape = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(shape);
    if (node && typeof node === "object")
      return Object.fromEntries(Object.entries(node).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, shape(v)]));
    return typeof node;
  };
  const base = JSON.stringify(shape(ko));
  for (const [name, dict] of [["ja", ja], ["zh", zh]] as const) {
    expect(JSON.stringify(shape(dict)), `${name} 사전의 키 구조가 한국어와 다르다`).toBe(base);
  }

  // 영어는 타입의 원본이라 번역표 두 개만 비어 있고 나머지 구조는 같아야 한다.
  const withoutTables = (dict: object) =>
    JSON.stringify(shape(Object.fromEntries(Object.entries(dict).filter(([k]) => k !== "kinds" && k !== "lib"))));
  expect(withoutTables(en), "영어 사전의 키 구조가 한국어와 다르다").toBe(withoutTables(ko));
  expect(Object.keys(en.kinds), "영어 kinds는 번역표의 키 원본이라 비어 있어야 한다").toEqual([]);
});

// 조판 규칙이 언어별로 갈렸는지 — 한국어 어절 줄바꿈이 일본어·중국어에 새지 않아야 한다.
test("word-break: keep-all은 한국어에만 걸린다 @static", () => {
  const css = readFileSync(join(__dirname, "..", "src", "app", "globals.css"), "utf8");
  const keepAll = css.split("\n").findIndex(line => line.includes("word-break: keep-all"));
  expect(keepAll, "word-break: keep-all이 사라졌다").toBeGreaterThan(-1);
  const scope = css.split("\n").slice(0, keepAll).reverse().find(line => line.includes("{"));
  expect(scope, "word-break: keep-all이 :lang(ko) 밖에 있다").toContain("lang(ko)");
});
