import { test } from 'node:test';
import assert from 'node:assert/strict';
import { birthdayWindow, buildArtistQuery, classifyPost } from './x-query.mjs';

const yena = { id: 'P-SOLO-YENA', name: 'YENA', korean: '최예나', aliases: ['예나', 'Choi Yena', 'Choi Ye-na'] };
const yuri = { id: 'P-SOLO-JOYURI', name: 'Jo Yuri', korean: '조유리', aliases: ['Jo Yu-ri', '유리'] };

test('an artist query combines names and event terms, keeps originals with images and drops trades', () => {
  const query = buildArtistQuery(yena);
  assert.ok(query.startsWith('(최예나 OR YENA OR 예나 OR "Choi Yena" OR "Choi Ye-na")'));
  assert.ok(query.includes('생일카페') && query.includes('컵홀더'));
  assert.ok(query.includes('has:images') && query.includes('-is:retweet') && query.includes('-is:reply'));
  assert.ok(query.includes('-(양도'));
  assert.ok(query.length <= 512);
  // 한도를 넘으면 별칭부터 줄인다.
  const short = buildArtistQuery(yena, { maxLength: 330 });
  assert.ok(short.length <= 330 && short.includes('최예나'));
});

test('the birthday window runs from three weeks before to three days after, in Korea time', () => {
  assert.deepEqual(birthdayWindow('09-29', 2026), { start_time: '2026-09-07T15:00:00Z', end_time: '2026-10-02T15:00:00Z' });
  assert.throws(() => birthdayWindow('9-29', 2026));
});

test('posts are sorted into review queues, trades and private places are dropped', () => {
  const cafe = classifyPost('🎂 최예나 생일카페 in 홍대 9/27~9/29 11:00-19:00 컵홀더 · 선착 포카 · 럭드', [yena, yuri]);
  assert.equal(cafe.excluded, null);
  assert.equal(cafe.category, 'birthdayCafe');
  assert.deepEqual(cafe.perks.sort(), ['cupsleeve', 'firstCome', 'luckyDraw', 'photocard'].sort());
  assert.deepEqual(cafe.artistIds, ['P-SOLO-YENA']);

  assert.equal(classifyPost('예나 생카 포카 양도합니다', [yena]).excluded, 'trade');
  assert.equal(classifyPost('숙소 앞 대기 중', [yena]).excluded, 'private-place');
  assert.equal(classifyPost('조유리 팝업스토어 성수', [yuri]).category, 'popup');
  // 두 글자 별칭만 나오면 약한 신호로 따로 둔다(유리 = 조유리? 권유리?).
  const weak = classifyPost('유리 생일 카페 컵홀더 이벤트', [yuri]);
  assert.deepEqual(weak.artistIds, []);
  assert.deepEqual(weak.weakArtistIds, ['P-SOLO-JOYURI']);
  assert.equal(classifyPost('오늘 날씨 좋다', []).category, null);
});
