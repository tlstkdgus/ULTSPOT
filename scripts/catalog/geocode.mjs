/**
 * 주소 → 좌표 조회. 결과를 카탈로그에 바로 쓰지 않고 검수용 사이드카로 남긴다.
 *
 *   pnpm data:geocode <입력 JSON> [배치 ID]
 *
 * 입력 형식: [{ "id": "hikr-ground", "address": "서울 중구 청계천로 40" }, ...]
 * 출력: .local-data/geocode/<배치 ID>/{request.json,response.json,review.json}  (git에 올라가지 않음)
 *
 * 왜 사이드카인가: 지오코딩은 비슷한 주소에 다른 건물을 물어올 수 있다. 사람이 review.json의
 * matchedAddress를 원래 주소와 대조하고 지도에서 한 번 확인한 뒤에야 src/lib/trip/catalog.ts의
 * coord에 넣는다. 자동 반영하지 않는다.
 *
 * 문서: https://developers.kakao.com/docs/latest/ko/kakaomap/rest-api (주소로 좌표 변환)
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const KOREA = { minLat: 33.0, maxLat: 38.7, minLng: 124.5, maxLng: 132.0 };
const inKorea = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= KOREA.minLat && lat <= KOREA.maxLat && lng >= KOREA.minLng && lng <= KOREA.maxLng;
const round5 = value => Math.round(value * 1e5) / 1e5;

async function geocode(address, key) {
  const url = new URL('https://dapi.kakao.com/v2/local/search/address.json');
  url.searchParams.set('query', address);
  url.searchParams.set('size', '1');
  const response = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
  if (!response.ok) return { ok: false, status: response.status };
  return { ok: true, body: await response.json() };
}

const [path, batchArg] = process.argv.slice(2);
const batchId = batchArg || `geocode-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

try {
  if (!path) throw new Error('usage');
  const key = process.env.KAKAO_REST_API_KEY?.trim();
  if (!key) {
    console.error('KAKAO_REST_API_KEY가 없습니다. .env.example의 안내와 docs/specs/map-and-routing.md §5를 보세요.');
    console.error('키 없이도 앱은 동작합니다. 모든 구간이 "이동시간 미확인"으로 표시됩니다.');
    process.exitCode = 1;
  } else {
    const rows = JSON.parse(await readFile(path, 'utf8'));
    if (!Array.isArray(rows) || !rows.length) throw new Error('empty');
    if (rows.length > 200) throw new Error('too many rows');

    const checkedOn = new Date().toISOString().slice(0, 10);
    const responses = [];
    const review = [];
    for (const row of rows) {
      if (typeof row?.id !== 'string' || typeof row?.address !== 'string' || !row.address.trim()) throw new Error('row');
      const result = await geocode(row.address, key);
      responses.push({ id: row.id, address: row.address, result });
      const document = result.ok ? result.body?.documents?.[0] : null;
      const lat = Number(document?.y);
      const lng = Number(document?.x);
      review.push(document && inKorea(lat, lng)
        ? {
            id: row.id, requestedAddress: row.address, matchedAddress: document.address_name ?? '',
            roadAddress: document.road_address?.address_name ?? null,
            // 이 값을 그대로 catalog.ts의 coord에 붙이기 전에 matchedAddress를 사람이 대조한다.
            coord: { lat: round5(lat), lng: round5(lng), source: 'https://developers.kakao.com/docs/latest/ko/kakaomap/rest-api', checked_on: checkedOn },
            status: 'needs-review',
          }
        : { id: row.id, requestedAddress: row.address, matchedAddress: null, roadAddress: null, coord: null, status: result.ok ? 'no-match' : `http-${result.status}` });
    }

    const folder = join('.local-data/geocode', batchId);
    await mkdir(folder, { recursive: true });
    const raw = JSON.stringify(responses, null, 2);
    await writeFile(join(folder, 'request.json'), JSON.stringify({ batchId, checkedOn, rows }, null, 2), { flag: 'wx' });
    await writeFile(join(folder, 'response.json'), raw, { flag: 'wx' });
    await writeFile(join(folder, 'review.json'), JSON.stringify(review, null, 2), { flag: 'wx' });

    const matched = review.filter(r => r.coord).length;
    console.log(`배치: ${batchId}`);
    console.log(`원본 SHA256: ${createHash('sha256').update(raw).digest('hex')}`);
    console.log(`좌표 후보 ${matched}/${review.length}건. 나머지는 review.json의 status를 보세요.`);
    console.log(`검수 파일: ${join(folder, 'review.json')}`);
    console.log('사람이 matchedAddress를 대조하고 지도에서 확인한 뒤에만 catalog.ts의 coord에 넣으세요. 자동 반영하지 않았습니다.');
  }
} catch (error) {
  if (error?.message === 'usage') console.error('Usage: pnpm data:geocode <입력 JSON> [배치 ID]');
  // 외부/개인 입력이 터미널에 새지 않도록 행 내용을 출력하지 않는다.
  else console.error(`지오코딩 실패 (${error.code || error.name}). 입력 형식과 경로를 확인하세요. 카탈로그는 변경되지 않았습니다.`);
  process.exitCode = 1;
}
