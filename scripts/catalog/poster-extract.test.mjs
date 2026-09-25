import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest, extractPoster, FALLBACK_MODEL, MODEL, parseExtraction, ROUTER_URL } from './poster-extract.mjs';

const image = 'data:image/png;base64,iVBORw0KGgo=';
const good = {
  title: '승민이의 가을방학', venue: '톤앤매너', address: '서울시 마포구 와우산로29가길 13 2층',
  from: '2026-09-20', to: '2026-09-22', opens: '11:00', closes: '19:00', birthday: '09-22', category: 'birthdayCafe',
  perks: ['cupsleeve', 'photocard', 'notAPerk'], conditions: ['1인 1음료'], artists: ['승민'],
  evidence: { birthday: 'SEPTEMBER 22', title: '승민이의 가을방학', venue: '톤앤매너', address: '와우산로29가길 13 2층', from: '9/20', to: '9/22', opens: '11:00', closes: '19:00', category: '생일카페', perks: '컵홀더 포카', conditions: '1인 1음료', artists: '승민' },
  confidence: { birthday: 0.95, title: 0.95, venue: 0.9, address: 0.92, from: 0.9, to: 0.9, opens: 0.6, closes: 0.9, category: 0.99, perks: 0.9, conditions: 0.8, artists: 0.97 },
};

test('the request asks for strict JSON from the chosen model, with the image and the fallback year', () => {
  const body = buildRequest({ image, postText: '승민 생일카페', year: 2026 });
  assert.equal(body.model, MODEL);
  assert.equal(body.temperature, 0);
  assert.deepEqual(body.chat_template_kwargs, { enable_thinking: false });
  assert.equal(body.response_format.type, 'json_schema');
  assert.equal(body.response_format.json_schema.strict, true);
  assert.equal(body.messages[1].content[1].image_url.url, image);
  assert.match(body.messages[1].content[0].text, /Year if missing: 2026/);
  assert.equal(buildRequest({ image, year: 2026, strict: false }).response_format.type, 'json_object');
  assert.throws(() => buildRequest({ image: 'http://x/a.png', year: 2026 }), /data URL or an https URL/);
  assert.throws(() => buildRequest({ image }), /year is required/);
});

test('a clean answer becomes review fields, unknown perks are dropped, and low confidence is flagged', () => {
  const out = parseExtraction(JSON.stringify(good), { postText: '🎂 1인 1음료 · 톤앤매너' });
  assert.deepEqual(out.issues, []);
  assert.equal(out.fields.opens, 660);
  assert.equal(out.fields.closes, 1140);
  assert.deepEqual(out.fields.perks, ['cupsleeve', 'photocard']);
  // opens 신뢰도 0.6 < 0.7 → 사람이 확인한다.
  assert.deepEqual(out.needsReview, ['opens']);
  assert.equal(out.inPost.conditions, true);
  assert.equal(out.inPost.address, false);
});

test('bad model output never throws: wrong formats are emptied and reported, missing evidence is flagged', () => {
  const out = parseExtraction('```json\n' + JSON.stringify({
    ...good, from: '2026-02-30', to: '9월 22일', opens: '18:00', closes: '02:00', category: 'concert',
    evidence: { ...good.evidence, address: '' },
  }) + '\n```');
  assert.equal(out.fields.from, null);
  assert.equal(out.fields.to, null);
  assert.equal(out.fields.opens, null);
  assert.equal(out.fields.category, null);
  assert.ok(out.issues.some(i => i.includes('from is not a real')));
  assert.ok(out.issues.some(i => i.includes('overnight')));
  for (const key of ['from', 'to', 'category', 'address']) assert.ok(out.needsReview.includes(key), key);

  assert.deepEqual(parseExtraction('not json').issues, ['Model output is not JSON.']);
  assert.equal(parseExtraction('[]').fields, null);
  const reversed = parseExtraction(JSON.stringify({ ...good, from: '2026-09-22', to: '2026-09-20' }));
  assert.equal(reversed.fields.to, null);
  assert.ok(reversed.issues.includes('from is after to.'));
});

/** 가짜 라우터. 응답 상태를 차례로 돌려주고, 받은 요청을 기록한다. */
function fakeRouter(statuses) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
    const status = statuses[calls.length - 1] ?? 200;
    return status === 200
      ? new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(good) } }], usage: { total_tokens: 900 } }), { status })
      : new Response('{}', { status });
  };
  return { calls, fetchImpl };
}

test('the router is called with the token; schema rejection retries as json_object, outages fall back to the second model', async () => {
  await assert.rejects(extractPoster({ image, year: 2026 }, {}), /HF_TOKEN is not set/);

  const ok = fakeRouter([200]);
  const result = await extractPoster({ image, year: 2026 }, { token: 'hf_test', fetchImpl: ok.fetchImpl });
  assert.equal(ok.calls[0].url, ROUTER_URL);
  assert.equal(ok.calls[0].auth, 'Bearer hf_test');
  assert.equal(result.model, MODEL);
  assert.equal(result.usage.total_tokens, 900);

  const schema = fakeRouter([400, 200]);
  await extractPoster({ image, year: 2026 }, { token: 'hf_test', fetchImpl: schema.fetchImpl });
  assert.deepEqual(schema.calls.map(c => c.body.response_format.type), ['json_schema', 'json_object']);

  const down = fakeRouter([503, 200]);
  const fallback = await extractPoster({ image, year: 2026 }, { token: 'hf_test', fetchImpl: down.fetchImpl });
  assert.equal(fallback.model, FALLBACK_MODEL);

  // 한도·키 문제는 모델을 바꿔도 소용없다. 한 번만 부르고 알린다.
  const limited = fakeRouter([429]);
  await assert.rejects(extractPoster({ image, year: 2026 }, { token: 'hf_test', fetchImpl: limited.fetchImpl }), /HTTP 429/);
  assert.equal(limited.calls.length, 1);
  // 무료 크레딧 소진(402)은 첫 실제 실행 중에 만났다(T-073). 결제 설정으로 안내한다.
  await assert.rejects(extractPoster({ image, year: 2026 }, { token: 'hf_test', fetchImpl: fakeRouter([402]).fetchImpl }), /credits are used up/);
});

test('evidence and confidence are keyed by our field names, so a renamed key never counts as evidence', () => {
  // T-073: 첫 실제 실행에서 모델이 title 근거를 event_name으로 적어 맞게 읽은 제목이 검수로 넘어갔다.
  const { evidence, confidence } = buildRequest({ image, year: 2026 }).response_format.json_schema.schema.properties;
  assert.equal(evidence.additionalProperties, false);
  assert.deepEqual(evidence.required, Object.keys(evidence.properties));
  assert.ok(evidence.required.includes('title') && confidence.required.includes('from'));
  const renamed = parseExtraction(JSON.stringify({ ...good, evidence: { event_name: good.title }, confidence: { event_name: 0.9 } }));
  assert.ok(renamed.needsReview.includes('title'));
});

test('a lone date that is the birthday is not taken as the event start', () => {
  // T-073: 실제 포스터 3장 중 2장에서 모델이 생일(SEPTEMBER 22, OCT 2ND)을 행사 시작일로 넣었다.
  const same = parseExtraction(JSON.stringify({ ...good, from: '2026-09-22', to: null, birthday: '09-22' }));
  assert.equal(same.fields.from, null);
  assert.equal(same.fields.birthday, '09-22');
  assert.ok(same.issues.some(i => i.includes('treated as the birthday')));
  // 생일과 다르더라도 끝 날짜 없이 하나뿐이면 반드시 검수로 넘긴다.
  const lone = parseExtraction(JSON.stringify({ ...good, from: '2026-10-02', to: null, birthday: null }));
  assert.equal(lone.fields.from, '2026-10-02');
  assert.ok(lone.needsReview.includes('from'));
  assert.equal(parseExtraction(JSON.stringify({ ...good, birthday: '9/22' })).fields.birthday, null);
});
