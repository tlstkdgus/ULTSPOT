import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const loaded = { exports: {} }; cache.set(file, loaded);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module: loaded, exports: loaded.exports, URL, require: id => load(path.resolve(path.dirname(file), id + '.ts')) });
  return loaded.exports;
}
const { eventCopy } = load('src/lib/trip/event-copy.ts');
const { catalog } = load('src/lib/trip/catalog.ts');
const { isPersonalEvent, reviewedOnlyKeys } = load('src/lib/trip/storage.ts');
const { catalogTranslationDrafts } = load('src/lib/trip/catalog-translation-drafts.ts');
const original = catalog[0];
const personal = { ...original, id: 'personal-test', from: '2026-09-21', to: '2026-09-21', closedDays: [], provenance: { mode: 'personal', author: 'visitor', url: 'https://example.com', checkedOn: '2026-09-20' } };
// 검수 전용 필드 목록은 storage.ts가 원천이다. 새 필드가 늘어도 이 fixture가 어긋나지 않는다.
for (const key of [...reviewedOnlyKeys, 'lastEntry', 'artistIds']) delete personal[key];
test('ja/zh optional translations fall back to English, never Korean', () => {
  for (const locale of ['ja','zh']) assert.equal(eventCopy(original, locale).title, original.title);
  assert.equal(eventCopy(original, 'ko').title, original.title_ko);
});
test('requested translation is selected per field; blank falls back', () => {
  const e = { ...original, title_ja: '日本語', title_zh: '中文', do_ja: '  ' };
  assert.equal(eventCopy(e,'ja').title,'日本語');
  assert.equal(eventCopy(e,'zh').title,'中文');
  assert.equal(eventCopy(e,'ja').do,original.do);
  assert.equal(eventCopy(e,'ja').get,original.get);
});
test('personal text remains original even with forged translations', () => {
  for (const locale of ['ja','zh']) assert.equal(eventCopy({ ...personal, title_ja:'fake', title_zh:'fake' },locale).title,personal.title);
});
test('personal draft rejects all eight locale fields and review metadata', () => {
  assert.equal(isPersonalEvent(personal),true);
  for (const key of ['title_ja','do_ja','get_ja','area_ja','title_zh','do_zh','get_zh','area_zh','translation_review']) {
    assert.equal(isPersonalEvent({ ...personal, [key]: 'injected' }),false,key);
    assert.equal(isPersonalEvent({ ...personal, [key]: null }),false,key);
  }
});
test('AI drafts remain unpublished and fall back even if accidentally combined', () => {
  for (const e of catalog) {
    // 초안이 없는 행사도 있다 (팬 주최 생일카페 3건). 없는 번역을 지어내지 않으므로 이는 정상이고,
    // 계약은 그대로다 — ja/zh는 영어로 떨어지고 카탈로그 행에는 번역 필드가 실리지 않는다.
    const draft = catalogTranslationDrafts[e.id];
    for (const locale of ['ja','zh']) {
      assert.equal(eventCopy({ ...e, ...draft },locale).title,e.title);
      if (draft) assert.equal(draft.translation_review[locale].title.status,'draft');
      assert.equal(e['title_' + locale],undefined);
    }
  }
});
