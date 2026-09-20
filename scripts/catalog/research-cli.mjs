/**
 * 조사 배치 접수·검증·변환.
 *
 *   pnpm data:research <접수 폴더> [배치 ID]
 *
 * 순서: 원본 보존 확인(SHA256) → 구조 검증 → 기존 ID 대조 → 변환 → 공개 자격 판정.
 * 아무것도 공개하지 않고 업로드하지 않는다. 출력은 .local-data(git 제외)로만 간다.
 * 원본은 읽기만 하고 절대 덮어쓰지 않는다.
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { convert, summarise, toCsv, validateResearch } from './research.mjs';

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex').toUpperCase();

const [folder, batchArg] = process.argv.slice(2);

try {
  if (!folder) throw new Error('usage');
  const files = await readdir(folder);
  if (!files.includes('research-batch.json')) throw new Error('missing research-batch.json');

  // 접수 기록이 있으면 그 해시와 대조한다. 없으면 이번에 계산한 해시를 기록한다.
  const receipt = files.includes('receipt.json') ? JSON.parse(await readFile(join(folder, 'receipt.json'), 'utf8')) : null;
  const originals = [];
  for (const name of files.filter(f => /\.(json|md)$/.test(f) && f !== 'receipt.json')) {
    const bytes = await readFile(join(folder, name));
    const digest = sha256(bytes);
    const recorded = receipt?.files?.find(f => f.file === name);
    originals.push({ file: name, bytes: bytes.length, sha256: digest,
      receiptMatch: recorded ? recorded.sha256?.toUpperCase() === digest && recorded.bytes === bytes.length : null });
  }
  const mismatched = originals.filter(o => o.receiptMatch === false);
  if (mismatched.length) throw new Error(`receipt hash mismatch: ${mismatched.map(m => m.file).join(', ')}`);

  const raw = await readFile(join(folder, 'research-batch.json'), 'utf8');
  const batch = JSON.parse(raw);
  const batchId = batchArg || batch.batch_id || `research-${new Date().toISOString().slice(0, 10)}`;

  const check = validateResearch(batch);
  const today = new Date().toISOString().slice(0, 10);
  const result = convert(batch, { today });
  const summary = summarise(result);

  const out = join('.local-data/research', batchId);
  await mkdir(join(out, 'intake'), { recursive: true });
  for (const [tab, rows] of Object.entries(result.intake)) {
    if (!rows.length) continue;
    await writeFile(join(out, 'intake', `${tab}.csv`), toCsv(rows), 'utf8');
  }
  await writeFile(join(out, 'sidecar.json'), JSON.stringify(result.sidecar, null, 2), 'utf8');
  await writeFile(join(out, 'eligibility.json'), JSON.stringify(result.eligibilities, null, 2), 'utf8');
  await writeFile(join(out, 'report.json'), JSON.stringify({
    batchId, receivedOn: today, originals, validation: check, summary,
    published: false, uploaded: false, approvedImages: 0,
  }, null, 2), 'utf8');

  console.log(`배치: ${batchId}`);
  const recorded = originals.filter(o => o.receiptMatch !== null);
  console.log(`원본 ${originals.length}개 읽기만 했다(덮어쓰지 않음). 접수 기록 대조: ${recorded.length}개 중 ${recorded.filter(o => o.receiptMatch).length}개 일치, 기록 없는 파일 ${originals.length - recorded.length}개`);
  console.log(`구조 검증: 오류 ${check.errors.length}건, 경고 ${check.warnings.length}건`);
  console.log(`레코드 ${check.counts.records}건 ${JSON.stringify(check.counts.byType)} · 출처 ${check.counts.sources}건 ${JSON.stringify(check.counts.byAccess)}`);
  console.log(`기존 ID 재사용 ${summary.reuseExisting} · 신규 후보 ${summary.newCandidates} · 보류 ${summary.hold}`);
  console.log(`발견 카드 공개 자격 ${summary.discoverable}건 · 자동 편성 자격 ${summary.autoSchedulable}건`);
  console.log(`  그중 지금 바로 올릴 수 있는 서울·창 안 행사 ${summary.discoverableSeoulEventsInWindow}건 (창 밖 ${summary.eventsOutsideWindow}건, 서울 외 ${summary.eventsOutsideSeoul}건 제외)`);
  console.log(`  이미 런타임에 공개된 대상 ${summary.alreadyInRuntime}건 · 출처 충돌 있는 대상 ${summary.withConflicts}건`);
  console.log('  공개 자격 false가 "내려라"는 뜻은 아니다. 이미 공개된 장소라면 "이번 배치로 갱신하지 말라"는 뜻이다.');
  console.log(`원문 보존 조건 행 ${summary.conditionRows}건 · 매핑 없는 사실 ${summary.unmappedFacts}건(사이드카 보존)`);
  console.log(`승인 이미지 ${summary.approvedImages}건`);
  console.log(`출력: ${out}`);
  console.log('공개·업로드·이미지 게시는 실행하지 않았습니다. 사람이 eligibility.json을 읽고 판단하세요.');
  if (check.errors.length) {
    console.log('--- 오류 ---');
    for (const error of check.errors) console.log(`  ${error}`);
    process.exitCode = 1;
  }
} catch (error) {
  if (error?.message === 'usage') console.error('Usage: pnpm data:research <접수 폴더> [배치 ID]');
  else if (error?.message?.startsWith('receipt hash mismatch')) console.error(`접수 실패: ${error.message}. 원본이 접수 기록과 다릅니다. 원본을 다시 받으세요.`);
  else if (error?.message === 'missing research-batch.json') console.error('접수 폴더에 research-batch.json이 없습니다.');
  // 외부 문자열이 터미널에 새지 않도록 레코드 내용을 출력하지 않는다.
  else console.error(`변환 실패 (${error.code || error.name}). 경로와 JSON 형식을 확인하세요. 원본은 변경되지 않았습니다.`);
  process.exitCode = 1;
}
