import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { estimateCostUsd } from './enrich-travel-places.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env.local');
const candidatePath = path.join(root, 'src/data/seoul-travel-place-localization-candidates.json');
const catalogPath = path.join(root, 'src/data/seoul-travel-places.json');
const outputPath = path.join(root, 'src/data/seoul-travel-place-localization-review.json');
const envText = await readFile(envPath, 'utf8').catch(() => '');
const model = process.env.OPENAI_MODEL || getEnvValue(envText, 'OPENAI_MODEL') || 'gpt-6-luna';
const maxSpendUsd = Number(
  process.env.LOCALIZATION_REVIEW_MAX_SPEND_USD ||
    getEnvValue(envText, 'LOCALIZATION_REVIEW_MAX_SPEND_USD') ||
    1,
);
const requestCostReserveUsd = 0.03;

function getEnvValue(text, name) {
  const line = text.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  const value = line?.slice(name.length + 1).trim();
  return value?.replace(
    /^(?:"(.*)"|'(.*)')$/,
    (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted,
  );
}

function readArgs(args) {
  const options = { limit: 25, offset: 0, dryRun: false, force: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') continue;
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--limit' || arg === '--offset') {
      const value = Number(args[index + 1]);
      if (!Number.isInteger(value) || value < 0 || (arg === '--limit' && value === 0)) {
        throw new Error(
          `${arg}에는 ${arg === '--limit' ? '1 이상의' : '0 이상의'} 정수를 지정하세요.`,
        );
      }
      options[arg.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`알 수 없는 옵션: ${arg}`);
    }
  }
  return options;
}

const reviewSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reviews'],
  properties: {
    reviews: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'enStatus',
          'enSuggestion',
          'enReason',
          'jaStatus',
          'jaSuggestion',
          'jaReason',
        ],
        properties: {
          id: { type: 'string' },
          enStatus: { type: 'string', enum: ['approved', 'corrected', 'needs_review'] },
          enSuggestion: { type: 'string' },
          enReason: { type: 'string' },
          jaStatus: { type: 'string', enum: ['approved', 'corrected', 'needs_review'] },
          jaSuggestion: { type: 'string' },
          jaReason: { type: 'string' },
        },
      },
    },
  },
};

function getResponseText(response) {
  return (response.output || [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .find((item) => item.type === 'output_text')?.text;
}

function normalizeLanguageReview(status, suggestion, reason, candidate) {
  const cleanedSuggestion = suggestion.trim();
  const cleanedReason = reason.trim();
  if (!cleanedSuggestion) throw new Error('검토 응답에 빈 번역이 있습니다.');
  if (status !== 'approved' && !cleanedReason)
    throw new Error('수정·추가 검토 사유가 비어 있습니다.');
  if (status === 'approved' || cleanedSuggestion === candidate) {
    return { status: 'approved', suggestion: candidate, reason: cleanedReason };
  }
  return { status, suggestion: cleanedSuggestion, reason: cleanedReason };
}

function validateReviews(reviews, places) {
  const placeById = new Map(places.map((place) => [place.id, place]));
  if (reviews.length !== places.length)
    throw new Error('응답 장소 수가 요청 배치와 일치하지 않습니다.');
  const seen = new Set();
  return reviews.map((review) => {
    const place = placeById.get(review.id);
    if (!place || seen.has(review.id))
      throw new Error(`응답에 알 수 없거나 중복된 ID가 있습니다: ${review.id}`);
    seen.add(review.id);
    return {
      id: review.id,
      sourceName: place.sourceName,
      candidate: place.localizedNames,
      review: {
        en: normalizeLanguageReview(
          review.enStatus,
          review.enSuggestion,
          review.enReason,
          place.localizedNames.en,
        ),
        ja: normalizeLanguageReview(
          review.jaStatus,
          review.jaSuggestion,
          review.jaReason,
          place.localizedNames.ja,
        ),
      },
    };
  });
}

export function selectReviewBatch(draftPlaces, entries, options) {
  const completedIds = new Set(entries.map((entry) => entry.id));
  const pendingPlaces = draftPlaces.filter((place) => options.force || !completedIds.has(place.id));
  return pendingPlaces.slice(options.offset, options.offset + options.limit);
}

async function reviewBatch(places, apiKey) {
  const input = [
    'Review first-pass English and Japanese display names for Seoul travel places.',
    'Use the Korean source name, district, category, tags, and supplied official URL as context. Do not invent official names or facts that are not supported by the input.',
    'Keep established brand names, acronyms, and commonly used romanization. Translate descriptive words naturally. Japanese should use natural Japanese place-name conventions.',
    'Mark each language approved only when its candidate is accurate and usable as a concise map label. If you can make a clear correction, return corrected with the replacement and a short reason. If identity or official spelling is uncertain, use needs_review and explain why.',
    'Always return a non-empty suggestion. For approved, repeat the candidate exactly.',
    'Review these places:',
    JSON.stringify(
      places.map((place) => ({
        id: place.id,
        koreanName: place.sourceName,
        district: place.sourceContext.district,
        category: place.sourceContext.category,
        placeType: place.sourceContext.placeType,
        tags: place.sourceContext.tags,
        officialUrl: place.sourceContext.officialUrl,
        englishCandidate: place.localizedNames.en,
        japaneseCandidate: place.localizedNames.ja,
      })),
    ),
  ].join('\n');

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model,
        max_output_tokens: 5000,
        reasoning: { effort: 'none' },
        text: {
          format: {
            type: 'json_schema',
            name: 'place_localization_review',
            strict: true,
            schema: reviewSchema,
          },
        },
        input,
      }),
    });
    if (response.ok) {
      const payload = await response.json();
      const text = getResponseText(payload);
      if (!text) throw new Error('AI 응답에서 구조화된 검토 결과를 찾지 못했습니다.');
      const parsed = JSON.parse(text);
      return {
        entries: validateReviews(parsed.reviews, places),
        usage: payload.usage ?? null,
      };
    }
    const detail = await response.text();
    let apiError;
    try {
      apiError = JSON.parse(detail).error;
    } catch {
      apiError = undefined;
    }
    const error = new Error(`OpenAI API ${response.status}: ${detail.slice(0, 500)}`);
    if (apiError?.code === 'credit_balance_exhausted' || apiError?.type === 'insufficient_quota') {
      error.stopBatch = true;
      throw error;
    }
    const retryable = response.status >= 500 || apiError?.code === 'rate_limit_exceeded';
    if (response.status === 429 && apiError?.code !== 'rate_limit_exceeded') {
      error.stopBatch = true;
      throw error;
    }
    if ([400, 401, 403, 404].includes(response.status)) {
      error.stopBatch = true;
      throw error;
    }
    if (!retryable || attempt === 2) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
  }
}

async function save(output) {
  const temporaryPath = `${outputPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(output, null, 2)}\n`);
  await rename(temporaryPath, outputPath);
}

async function main() {
  const options = readArgs(process.argv.slice(2));
  const candidatesFile = JSON.parse(await readFile(candidatePath, 'utf8'));
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  if (candidatesFile.schemaVersion !== 1)
    throw new Error('지원하지 않는 번역 후보 파일 버전입니다.');
  const catalogById = new Map(catalog.places.map((place) => [place.id, place]));
  const draftPlaces = candidatesFile.places.filter(
    (place) => place.status.en === 'first_pass_draft' || place.status.ja === 'first_pass_draft',
  );
  for (const candidate of candidatesFile.places) {
    const source = catalogById.get(candidate.id);
    if (!source || source.name !== candidate.sourceName) {
      throw new Error(`원본 카탈로그와 후보 데이터가 일치하지 않습니다: ${candidate.id}`);
    }
  }
  const output = await readFile(outputPath, 'utf8')
    .then(JSON.parse)
    .catch(() => ({
      schemaVersion: 1,
      sourceCandidates: path.basename(candidatePath),
      entries: [],
      requests: [],
    }));
  output.requests ??= [];
  const batch = selectReviewBatch(draftPlaces, output.entries, options);

  if (!batch.length) {
    console.log('검토할 장소가 없습니다. --force 또는 다른 --offset을 사용하세요.');
    return;
  }
  if (options.dryRun) {
    console.log(
      `검토 배치 준비: ${batch.length}곳 (offset ${options.offset}, API 호출·토큰 사용 없음)`,
    );
    for (const place of batch) console.log(`${place.id}\t${place.sourceName}`);
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY || getEnvValue(envText, 'OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY가 필요합니다. 키는 저장소 파일에 기록하지 마세요.');
  estimateCostUsd({ input_tokens: 0, output_tokens: 0 }, 0, model);
  if (!Number.isFinite(maxSpendUsd) || maxSpendUsd <= 0) {
    throw new Error('LOCALIZATION_REVIEW_MAX_SPEND_USD에는 0보다 큰 금액을 지정하세요.');
  }

  let processed = 0;
  for (let index = 0; index < batch.length; index += 25) {
    const group = batch.slice(index, index + 25);
    const knownSpendUsd = output.requests.reduce(
      (sum, request) => sum + (request.estimatedCostUsd || 0),
      0,
    );
    if (knownSpendUsd + requestCostReserveUsd >= maxSpendUsd) {
      console.log(
        `비용 안전 상한으로 중단합니다: $${knownSpendUsd.toFixed(4)} / $${maxSpendUsd.toFixed(2)}`,
      );
      break;
    }
    try {
      const { entries, usage } = await reviewBatch(group, apiKey);
      if (!usage) {
        const error = new Error('응답에 토큰 사용량이 없어 비용을 계산할 수 없습니다.');
        error.stopBatch = true;
        throw error;
      }
      const estimatedCostUsd = estimateCostUsd(usage, 0, model);
      const requestId = `localization-${Date.now()}-${index}`;
      const reviewedAt = new Date().toISOString().slice(0, 10);
      output.entries = output.entries.filter(
        (entry) => !group.some((place) => place.id === entry.id),
      );
      output.entries.push(
        ...entries.map((entry) => ({
          ...entry,
          reviewedAt,
          model,
          requestId,
        })),
      );
      output.requests.push({
        requestId,
        placeIds: group.map((place) => place.id),
        reviewedAt,
        model,
        usage,
        estimatedCostUsd,
      });
      output.model = model;
      await save(output);
      processed += entries.length;
      console.log(
        `[${Math.min(index + group.length, batch.length)}/${batch.length}] ${entries.length}곳 검토 완료`,
      );
    } catch (error) {
      console.error(`검토 배치 오류: ${error.message}`);
      if (error.stopBatch) break;
    }
    if (index + 25 < batch.length) await new Promise((resolve) => setTimeout(resolve, 800));
  }

  const totals = output.entries.reduce(
    (sum, entry) => {
      const request = output.requests.find((item) => item.requestId === entry.requestId);
      if (request && !sum.countedRequests.has(request.requestId)) {
        sum.countedRequests.add(request.requestId);
        sum.inputTokens += request.usage?.input_tokens || 0;
        sum.outputTokens += request.usage?.output_tokens || 0;
        sum.estimatedCostUsd += request.estimatedCostUsd || 0;
      }
      return sum;
    },
    { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, countedRequests: new Set() },
  );
  const latest = output.entries.filter((entry) => batch.some((place) => place.id === entry.id));
  const statuses = latest.flatMap((entry) => [entry.review.en.status, entry.review.ja.status]);
  console.log(
    `검토 결과 저장: ${path.relative(root, outputPath)} (${output.entries.length}개 누적)`,
  );
  console.log(
    `이번 실행: ${processed}곳 · 승인 ${statuses.filter((status) => status === 'approved').length}개 · 수정 제안 ${statuses.filter((status) => status === 'corrected').length}개 · 추가 검토 ${statuses.filter((status) => status === 'needs_review').length}개`,
  );
  console.log(
    `추정 누적 비용: $${totals.estimatedCostUsd.toFixed(4)} / $${maxSpendUsd.toFixed(2)} 상한 · 입력 ${totals.inputTokens.toLocaleString()} / 출력 ${totals.outputTokens.toLocaleString()} 토큰`,
  );
  console.log('결과는 검토 전용 파일에 저장하며 앱 카탈로그를 변경하지 않습니다.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
