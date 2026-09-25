// 팬 이벤트 포스터 → 구조화된 후보 (T-071). 설계는 docs/data/x-collection-plan.md §3의 "3) 추출".
//
// 모델: Hugging Face Inference Providers(router.huggingface.co, OpenAI 호환)로 Qwen/Qwen3.8-27B를 부른다.
//   고른 이유(2026-09-25 확인): 이미지 입력을 기본 지원, OmniDocBench 1.5 91.1(모델 카드), Apache-2.0,
//   HF 추론 제공자 5곳(novita·cerebras·featherless-ai·ovhcloud·deepinfra) live. 한 곳이 내려가도 라우터가 다른 곳으로 간다.
//   대체 모델 google/gemma-4-31B-it(Apache-2.0, live 3곳) — 기본 모델이 없거나 5xx면 한 번 바꿔 부른다.
//   OCR 전용 모델(GLM-OCR 등)은 글자는 잘 읽지만 "기간·주소·특전"으로 나누지 않고, HF 추론 제공자에서 live가 아니었다.
//
// 원칙: 모델 출력은 **검수 대기열로만** 간다. 카탈로그에 바로 넣지 않는다. 필드마다 모델이 준 근거 문구(evidence)와
// 신뢰도(confidence)를 남기고, 형식이 틀리거나 근거가 없거나 신뢰도가 낮은 필드는 needsReview로 표시한다.
// 키(HF_TOKEN)는 이 스크립트를 돌리는 사람의 환경 변수에만 둔다. 앱 서버·Vercel에는 넣지 않는다.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join } from 'node:path';
import { PERK_TERMS } from './x-query.mjs';

export const ROUTER_URL = 'https://router.huggingface.co/v1/chat/completions';
export const MODEL = 'Qwen/Qwen3.8-27B';
export const FALLBACK_MODEL = 'google/gemma-4-31B-it';
/** 이 값보다 낮은 신뢰도의 필드는 사람이 원문과 대조한다. 첫 수집 5명 결과를 보고 조정한다. */
export const REVIEW_BELOW = 0.7;

const CATEGORIES = ['birthdayCafe', 'support', 'popup', 'filming'];
const PERKS = Object.keys(PERK_TERMS);
const FIELDS = ['title', 'venue', 'address', 'from', 'to', 'opens', 'closes', 'birthday', 'category', 'perks', 'conditions', 'artists'];

const keyed = (value, description) => ({
  type: 'object', additionalProperties: false, required: FIELDS, description,
  properties: Object.fromEntries(FIELDS.map(key => [key, value])),
});

/** 모델에게 주는 출력 형식. json_schema(strict)로 보내고, 받은 뒤에도 parseExtraction이 다시 검사한다. */
export const EXTRACTION_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: [...FIELDS, 'evidence', 'confidence'],
  properties: {
    title: { type: ['string', 'null'] },
    venue: { type: ['string', 'null'], description: '카페·장소 이름' },
    address: { type: ['string', 'null'], description: '포스터에 적힌 주소 그대로' },
    from: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
    to: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
    opens: { type: ['string', 'null'], description: 'HH:MM, 24시간' },
    closes: { type: ['string', 'null'], description: 'HH:MM, 24시간' },
    // 생일 날짜를 따로 받는다(T-073). 받을 칸이 없으니 모델이 "SEPTEMBER 22"·"OCT 2ND"를 행사 시작일(from)에 넣었다.
    birthday: { type: ['string', 'null'], description: '포스터의 생일 날짜 MM-DD (예: SEPTEMBER 22 → 09-22). 행사 기간이 아니다' },
    category: { type: ['string', 'null'], enum: [...CATEGORIES, null] },
    perks: { type: 'array', items: { type: 'string', enum: PERKS } },
    conditions: { type: 'array', items: { type: 'string' }, description: '참여 조건(1인 1음료, 선착순 인원 등) 원문' },
    artists: { type: 'array', items: { type: 'string' }, description: '포스터에 적힌 아티스트 이름 그대로' },
    // 근거·신뢰도의 키를 필드 이름으로 고정한다(T-073). 자유 키로 두었더니 첫 실행(2026-09-25)에서 모델이
    // title 대신 event_name, from 대신 date라고 적어, 맞게 읽은 제목이 "근거 없음"으로 검수에 넘어갔다.
    evidence: keyed({ type: ['string', 'null'] }, '필드 이름 → 포스터·본문에 실제로 적힌 문구. 값이 없으면 null'),
    confidence: keyed({ type: ['number', 'null'] }, '필드 이름 → 0~1. 값이 없으면 null'),
  },
};

const PROMPT = [
  'You read Korean K-pop fan event posters (birthday cafes, cup-sleeve events, fan-funded birthday ads, pop-ups).',
  'Return ONLY what is written on the poster or in the post text. Never guess. If a field is not written, use null (or an empty list).',
  'Dates: write YYYY-MM-DD. If the year is missing, use the year given below. Times: 24-hour HH:MM.',
  `A lone date on a birthday poster ("SEPTEMBER 22", "OCT 2ND", "0922", "SM'S DAY") is the artist's BIRTHDAY: put it in birthday as MM-DD, never in from/to.`,
  'Fill from/to only when the poster or post states the event period (a range like 9/20~9/22, or words like 기간/운영/OPEN).',
  'Titles use decorative fonts: copy every syllable exactly, including particles like 이/의 and symbols like ♡. If unsure of any syllable, confidence below 0.7.',
  'address: copy the Korean address exactly as written. Do not complete or correct it.',
  `evidence and confidence use exactly these keys: ${FIELDS.join(', ')}.`,
  'evidence: for every non-null field, the exact words you read it from.',
  'confidence: for every non-null field, 0 to 1. Use below 0.7 when text is small, cut off, stylised or ambiguous.',
  `perks must be from: ${PERKS.join(', ')}. category must be from: ${CATEGORIES.join(', ')} or null.`,
  'Private places (dorms, homes, company entrances, airports) are not events: if the poster points to one, return all fields null.',
].join('\n');

/** 로컬 파일 → data URL. X 이미지 URL은 제공자가 못 받아 올 수 있어(차단·만료) 파일로 받아 넘기는 쪽을 기본으로 한다. */
export async function imageDataUrl(path) {
  const type = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[extname(path).toLowerCase()];
  if (!type) throw new Error(`Unsupported image type: ${path}`);
  const bytes = await readFile(path);
  if (bytes.length > 8 * 1024 * 1024) throw new Error('Image is larger than 8 MB. Resize it before extraction.');
  return `data:${type};base64,${bytes.toString('base64')}`;
}

export function buildRequest({ image, postText = '', year, model = MODEL, strict = true }) {
  if (!/^(data:image\/(png|jpeg|webp);base64,|https:\/\/)/.test(image)) throw new Error('Image must be a data URL or an https URL.');
  if (!Number.isInteger(year)) throw new Error('year is required (posters often omit it).');
  return {
    model,
    temperature: 0,
    // 1200이었을 때 경민 포스터에서 추론(생각) 토큰이 1200을 다 써서 답이 비었다(T-073, 2026-09-25).
    max_tokens: 4000,
    // 포스터 읽기는 추론이 거의 필요 없다. Qwen3.8은 생각 모드가 기본이라 끈다(모델 카드: enable_thinking false).
    // reasoning_effort 'low'만으로는 꺼지지 않았다(추론 301~1200토큰). 지원하지 않는 제공자는 무시한다.
    reasoning_effort: 'low',
    chat_template_kwargs: { enable_thinking: false },
    // 제공자마다 json_schema 지원이 다르다. 400이면 json_object로 한 번 더 보낸다(형식 검사는 parseExtraction이 한다).
    response_format: strict
      ? { type: 'json_schema', json_schema: { name: 'fan_event_poster', strict: true, schema: EXTRACTION_SCHEMA } }
      : { type: 'json_object' },
    messages: [
      { role: 'system', content: PROMPT },
      { role: 'user', content: [
        { type: 'text', text: `Year if missing: ${year}\nPost text (may be empty):\n${String(postText).slice(0, 2000)}` },
        { type: 'image_url', image_url: { url: image } },
      ] },
    ],
  };
}

const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const toMinutes = v => {
  const m = typeof v === 'string' ? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(v) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const text = (v, max = 300) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/**
 * 모델 응답(문자열) → 검수용 후보. 모델이 틀린 형식을 줘도 던지지 않는다 — 그 필드를 비우고 이유를 issues에 남긴다.
 * needsReview: 사람이 반드시 원문과 대조할 필드. 값이 있는데 근거가 없거나, 신뢰도가 REVIEW_BELOW 미만이거나, 형식을 고친 필드.
 */
export function parseExtraction(content, { postText = '' } = {}) {
  let raw;
  const body = String(content ?? '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { raw = JSON.parse(body); } catch { return { fields: null, needsReview: FIELDS, issues: ['Model output is not JSON.'] }; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { fields: null, needsReview: FIELDS, issues: ['Model output is not an object.'] };

  const issues = [];
  const evidence = raw.evidence && typeof raw.evidence === 'object' ? raw.evidence : {};
  const confidence = raw.confidence && typeof raw.confidence === 'object' ? raw.confidence : {};
  const fields = {
    title: text(raw.title, 120), venue: text(raw.venue, 120), address: text(raw.address),
    from: isDate(raw.from) ? raw.from : null, to: isDate(raw.to) ? raw.to : null,
    opens: toMinutes(raw.opens), closes: toMinutes(raw.closes),
    birthday: typeof raw.birthday === 'string' && /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(raw.birthday) ? raw.birthday : null,
    category: CATEGORIES.includes(raw.category) ? raw.category : null,
    perks: Array.isArray(raw.perks) ? [...new Set(raw.perks.filter(p => PERKS.includes(p)))] : [],
    conditions: Array.isArray(raw.conditions) ? raw.conditions.map(c => text(c, 200)).filter(Boolean).slice(0, 10) : [],
    artists: Array.isArray(raw.artists) ? raw.artists.map(a => text(a, 60)).filter(Boolean).slice(0, 10) : [],
  };
  if (raw.from != null && !fields.from) issues.push(`from is not a real YYYY-MM-DD date: ${raw.from}`);
  if (raw.to != null && !fields.to) issues.push(`to is not a real YYYY-MM-DD date: ${raw.to}`);
  if (fields.from && fields.to && fields.from > fields.to) { issues.push('from is after to.'); fields.to = null; }
  if (raw.birthday != null && !fields.birthday) issues.push(`birthday is not MM-DD: ${raw.birthday}`);
  // 기간 없이 날짜 하나만 있으면 생일일 가능성이 크다(첫 실행 3장 중 2장이 그랬다). 값은 두되 반드시 검수한다.
  const loneDate = fields.from !== null && fields.to === null;
  if (loneDate) issues.push('Only one date and no end date — it may be the birthday, not the event period.');
  if (fields.from && fields.birthday && fields.from.slice(5) === fields.birthday && !fields.to) {
    issues.push('from equals the birthday — treated as the birthday.'); fields.from = null;
  }
  if (raw.opens != null && fields.opens === null) issues.push(`opens is not HH:MM: ${raw.opens}`);
  if (raw.closes != null && fields.closes === null) issues.push(`closes is not HH:MM: ${raw.closes}`);
  // 자정을 넘기는 영업(예: 18:00–02:00)은 앱의 하루 모델로 표현하지 못한다. 시간을 버리고 검수로 넘긴다.
  if (fields.opens !== null && fields.closes !== null && fields.opens >= fields.closes) {
    issues.push('closes is not after opens (overnight or misread).'); fields.opens = null; fields.closes = null;
  }

  const hasValue = key => { const v = fields[key]; return Array.isArray(v) ? v.length > 0 : v !== null; };
  const needsReview = FIELDS.filter(key => {
    if (key === 'from' && loneDate && fields.from) return true;
    if (!hasValue(key)) return raw[key] != null && !(Array.isArray(raw[key]) && raw[key].length === 0);
    const c = Number(confidence[key]);
    return !text(evidence[key]) || !Number.isFinite(c) || c < REVIEW_BELOW;
  });
  // 본문에도 같은 글자가 있으면 근거가 둘이다. 없어도 틀린 건 아니다(포스터에만 적힌 경우가 많다) — 표시만 한다.
  const inPost = Object.fromEntries(FIELDS.filter(hasValue).map(key => [key, !!postText && !!text(evidence[key]) && String(postText).includes(String(evidence[key]).trim())]));
  return { fields, needsReview, issues, evidence, confidence, inPost };
}

/**
 * 한 장 추출. json_schema가 거부되면(400) json_object로 한 번 더, 기본 모델이 없거나(404) 제공자가 모두 실패하면(5xx)
 * 대체 모델로 한 번 더 부른다.
 * 429(한도)와 401/403(키)은 바꿔 불러도 소용없어 그대로 알린다.
 */
export async function extractPoster({ image, postText = '', year }, { token, fetchImpl = fetch, models = [MODEL, FALLBACK_MODEL], signal } = {}) {
  if (!token) throw new Error('HF_TOKEN is not set. Create a fine-grained token with "Make calls to Inference Providers" permission.');
  let lastError = null;
  for (const model of models) {
    let response;
    for (const strict of [true, false]) {
      response = await fetchImpl(ROUTER_URL, {
        method: 'POST', signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequest({ image, postText, year, model, strict })),
      });
      if (response.status !== 400) break;
    }
    if (response.ok) {
      const json = await response.json();
      const choice = json?.choices?.[0];
      const parsed = parseExtraction(choice?.message?.content, { postText });
      // 한도에 걸려 잘린 답은 "JSON이 아님"과 원인이 다르다. 따로 알린다.
      if (choice?.finish_reason === 'length') parsed.issues.unshift('Output hit the token limit and was cut off.');
      return { model, usage: json?.usage ?? null, ...parsed };
    }
    lastError = `${model}: HTTP ${response.status}`;
    if (response.status !== 404 && response.status < 500) break;
  }
  const hint = / 40[13]$/.test(lastError ?? '') ? ' Check that HF_TOKEN has the "Make calls to Inference Providers" permission.'
    : / 402$/.test(lastError ?? '') ? ' Inference credits are used up — add billing or wait for the monthly credits at https://huggingface.co/settings/billing.'
    : / 429$/.test(lastError ?? '') ? ' Rate limited — wait a minute and try again.' : '';
  throw new Error(`Extraction failed (${lastError}).${hint}`);
}

// CLI: node --env-file=.env.local scripts/catalog/poster-extract.mjs <이미지 파일> [본문 텍스트 파일] [연도]
// 결과는 .local-data/extract/<해시>.json(검수 사이드카, git 제외)에 쓴다. 카탈로그는 건드리지 않는다.
if (process.argv[1]?.split(/[\\/]/).slice(-3).join('/') === 'scripts/catalog/poster-extract.mjs') {
  const [imagePath, postPath, yearArg] = process.argv.slice(2);
  if (!imagePath) { console.error('usage: poster-extract.mjs <image> [post.txt] [year]'); process.exit(2); }
  const postText = postPath ? await readFile(postPath, 'utf8') : '';
  const year = Number(yearArg ?? new Date(Date.now() + 9 * 3600000).getUTCFullYear());
  const image = await imageDataUrl(imagePath);
  const result = await extractPoster({ image, postText, year }, { token: process.env.HF_TOKEN });
  const id = createHash('sha256').update(image).digest('hex').slice(0, 16);
  const dir = join('.local-data', 'extract');
  await mkdir(dir, { recursive: true });
  const out = join(dir, `${id}.json`);
  await writeFile(out, JSON.stringify({ image: imagePath, extractedAt: new Date().toISOString(), ...result }, null, 2));
  console.log(`${out}\nmodel ${result.model} · needs review: ${result.needsReview.join(', ') || 'none'}${result.issues.length ? `\nissues: ${result.issues.join(' / ')}` : ''}`);
}
