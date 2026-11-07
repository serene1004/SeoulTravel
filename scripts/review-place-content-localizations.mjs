import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { estimateCostUsd } from './enrich-travel-places.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env.local');
const catalogPath = path.join(root, 'src/data/seoul-travel-places.json');
const outputPath = path.join(root, 'src/data/seoul-travel-place-content-localization-review.json');
const envText = await readFile(envPath, 'utf8').catch(() => '');
const model = process.env.OPENAI_MODEL || getEnvValue(envText, 'OPENAI_MODEL') || 'gpt-6-luna';
const maxSpendUsd = Number(
  process.env.CONTENT_LOCALIZATION_MAX_SPEND_USD ||
    getEnvValue(envText, 'CONTENT_LOCALIZATION_MAX_SPEND_USD') ||
    1,
);
export const fields = ['address', 'tags', 'hours', 'closedDays', 'transport', 'curationReason'];
const batchSize = 5;
const requestCostReserveUsd = 0.03;

function getEnvValue(text, name) {
  const line = text.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  const value = line?.slice(name.length + 1).trim();
  return value?.replace(
    /^(?:"(.*)"|'(.*)')$/,
    (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted,
  );
}

export function readArgs(args) {
  const options = {
    limit: 25,
    offset: 0,
    dryRun: false,
    force: false,
    retryNeedsReview: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') continue;
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--retry-needs-review') options.retryNeedsReview = true;
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

export function sourceFields(place) {
  return Object.fromEntries(fields.map((field) => [field, place[field] || '']));
}

export function selectReviewBatch(candidatePlaces, existingById, options) {
  const pendingPlaces = candidatePlaces.filter((place) => {
    const current = existingById.get(place.id);
    return (
      options.retryNeedsReview ||
      options.force ||
      !current ||
      current.sourceFingerprint !== fingerprint(sourceFields(place))
    );
  });
  return pendingPlaces.slice(options.offset, options.offset + options.limit);
}

export function fingerprint(values) {
  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}

const languageReviewSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'reason', 'fields'],
  properties: {
    status: { type: 'string', enum: ['approved', 'corrected', 'needs_review'] },
    reason: { type: 'string' },
    fields: {
      type: 'object',
      additionalProperties: false,
      required: fields,
      properties: Object.fromEntries(fields.map((field) => [field, { type: 'string' }])),
    },
  },
};

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
        required: ['id', 'en', 'ja'],
        properties: {
          id: { type: 'string' },
          en: languageReviewSchema,
          ja: languageReviewSchema,
        },
      },
    },
  },
};

export function validateReviews(reviews, places) {
  if (reviews.length !== places.length) throw new Error('응답 장소 수가 요청 배치와 다릅니다.');
  const placeById = new Map(places.map((place) => [place.id, place]));
  const seen = new Set();
  return reviews.map((review) => {
    const place = placeById.get(review.id);
    if (!place || seen.has(review.id)) throw new Error(`알 수 없거나 중복된 ID: ${review.id}`);
    seen.add(review.id);
    const source = sourceFields(place);
    const languages = {};
    for (const language of ['en', 'ja']) {
      const result = review[language];
      let status = result.status;
      let reason = result.reason.trim();
      if (result.status !== 'approved' && !result.reason.trim()) {
        throw new Error(`${review.id} ${language} 수정·추가 검토 사유가 비어 있습니다.`);
      }
      for (const field of fields) {
        if (Boolean(source[field]) !== Boolean(result.fields[field]?.trim())) {
          throw new Error(
            `${review.id} ${language}.${field} 번역이 비어 있거나 원문에 없는 값을 만들었습니다.`,
          );
        }
      }
      const sourceTagCount = source.tags.split(/[,、]/).filter((tag) => tag.trim()).length;
      const translatedTagCount = result.fields.tags
        .split(/[,、]/)
        .filter((tag) => tag.trim()).length;
      if (source.tags && translatedTagCount !== sourceTagCount) {
        status = 'needs_review';
        reason = `${reason} 태그 개수가 원문과 다릅니다.`.trim();
      }
      languages[language] = {
        status,
        reason,
        fields: Object.fromEntries(fields.map((field) => [field, result.fields[field].trim()])),
      };
    }
    return {
      id: place.id,
      sourceFingerprint: fingerprint(source),
      source,
      review: languages,
    };
  });
}

function getResponseText(response) {
  return (response.output || [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .find((item) => item.type === 'output_text')?.text;
}

async function reviewBatch(places, apiKey) {
  const input = [
    'Translate and review the supplied Seoul travel place information from Korean into natural English and Japanese.',
    'Keep factual values unchanged: preserve addresses as readable romanized/localized addresses, times, dates, transit line numbers, station/exit numbers, bus numbers, and proper names. Never invent missing details.',
    'For tags, translate each source tag one-to-one, preserve order, and return exactly the same number of tags. Use commas only as separators; never put commas inside an individual tag. For transport, preserve each route as one line and do not add or remove route line breaks. Translate curation reasons naturally and concisely.',
    'When a source field is empty, return an empty string. Use needs_review if a translation cannot be made reliably; still provide a best-effort translation for non-empty fields and explain uncertainty.',
    'Review these places:',
    JSON.stringify(
      places.map((place) => ({
        id: place.id,
        name: place.name,
        district: place.district,
        category: place.category,
        fields: sourceFields(place),
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
        max_output_tokens: 8000,
        reasoning: { effort: 'none' },
        text: {
          format: {
            type: 'json_schema',
            name: 'place_content_localization_review',
            strict: true,
            schema: reviewSchema,
          },
        },
        input,
      }),
    });
    if (response.ok) {
      const payload = await response.json();
      return { text: getResponseText(payload), usage: payload.usage ?? null };
    }
    const detail = await response.text();
    let apiError;
    try {
      apiError = JSON.parse(detail).error;
    } catch {
      apiError = undefined;
    }
    const error = new Error(`OpenAI API ${response.status}: ${detail.slice(0, 500)}`);
    if (apiError?.code === 'credit_balance_exhausted' || apiError?.type === 'insufficient_quota')
      error.stopBatch = true;
    if (response.status === 429 && apiError?.code !== 'rate_limit_exceeded') error.stopBatch = true;
    if ([400, 401, 403, 404].includes(response.status)) error.stopBatch = true;
    if (error.stopBatch || response.status < 500 || attempt === 2) throw error;
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
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const output = await readFile(outputPath, 'utf8')
    .then(JSON.parse)
    .catch(() => ({ schemaVersion: 1, entries: [], requests: [] }));
  output.requests ??= [];
  const retriedIds = new Set(
    output.requests
      .filter((request) => request.retryNeedsReview && !request.validationError)
      .flatMap((request) => request.placeIds),
  );
  const existingById = new Map(output.entries.map((entry) => [entry.id, entry]));
  const candidatePlaces = options.retryNeedsReview
    ? catalog.places.filter((place) => {
        const current = existingById.get(place.id);
        return (
          current &&
          !retriedIds.has(place.id) &&
          current.sourceFingerprint === fingerprint(sourceFields(place)) &&
          ['en', 'ja'].some((language) => current.review[language]?.status === 'needs_review')
        );
      })
    : catalog.places;
  const batch = selectReviewBatch(candidatePlaces, existingById, options);
  if (!batch.length) {
    console.log('검토할 장소가 없습니다. --force 또는 다른 --offset을 사용하세요.');
    return;
  }
  if (options.dryRun) {
    console.log(
      `번역 검토 배치 준비: ${batch.length}곳 (offset ${options.offset}, API 호출·토큰 사용 없음)`,
    );
    for (const place of batch) console.log(`${place.id}\t${place.name}`);
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY || getEnvValue(envText, 'OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY가 필요합니다. 키는 저장소 파일에 기록하지 마세요.');
  if (!Number.isFinite(maxSpendUsd) || maxSpendUsd <= 0)
    throw new Error('CONTENT_LOCALIZATION_MAX_SPEND_USD에는 0보다 큰 금액을 지정하세요.');

  let processed = 0;
  for (let index = 0; index < batch.length; index += batchSize) {
    const group = batch.slice(index, index + batchSize);
    const knownSpend = output.requests.reduce(
      (sum, request) => sum + (request.estimatedCostUsd || 0),
      0,
    );
    if (knownSpend + requestCostReserveUsd >= maxSpendUsd) {
      console.log(
        `비용 안전 상한으로 중단: $${knownSpend.toFixed(4)} / $${maxSpendUsd.toFixed(2)}`,
      );
      break;
    }
    try {
      const { text, usage } = await reviewBatch(group, apiKey);
      if (!usage)
        throw Object.assign(new Error('응답에 토큰 사용량이 없어 비용을 계산할 수 없습니다.'), {
          stopBatch: true,
        });
      const requestId = `content-localization-${Date.now()}-${index}`;
      const reviewedAt = new Date().toISOString().slice(0, 10);
      const estimatedCostUsd = estimateCostUsd(usage, 0, model);
      let entries;
      let validationError;
      try {
        if (!text) throw new Error('AI 응답에서 구조화된 번역 결과를 찾지 못했습니다.');
        entries = validateReviews(JSON.parse(text).reviews, group);
      } catch (error) {
        validationError = error.message;
      }
      if (validationError) {
        output.requests.push({
          requestId,
          retryNeedsReview: options.retryNeedsReview,
          placeIds: group.map((place) => place.id),
          reviewedAt,
          model,
          usage,
          estimatedCostUsd,
          validationError,
        });
        await save(output);
        console.error(
          `[${Math.min(index + group.length, batch.length)}/${batch.length}] 응답 검증 실패 (토큰 사용량 기록, 결과 재시도 필요): ${validationError}`,
        );
        continue;
      }
      output.entries = output.entries.filter(
        (entry) => !group.some((place) => place.id === entry.id),
      );
      output.entries.push(...entries.map((entry) => ({ ...entry, reviewedAt, model, requestId })));
      output.requests.push({
        requestId,
        retryNeedsReview: options.retryNeedsReview,
        placeIds: group.map((place) => place.id),
        reviewedAt,
        model,
        usage,
        estimatedCostUsd,
      });
      await save(output);
      processed += entries.length;
      console.log(
        `[${Math.min(index + group.length, batch.length)}/${batch.length}] ${entries.length}곳 처리 완료`,
      );
    } catch (error) {
      console.error(`번역 검토 오류: ${error.message}`);
      if (error.stopBatch) break;
    }
    if (index + batchSize < batch.length) await new Promise((resolve) => setTimeout(resolve, 800));
  }
  const totals = output.requests.reduce(
    (sum, request) => ({
      inputTokens: sum.inputTokens + (request.usage?.input_tokens || 0),
      outputTokens: sum.outputTokens + (request.usage?.output_tokens || 0),
      estimatedCostUsd: sum.estimatedCostUsd + (request.estimatedCostUsd || 0),
    }),
    { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
  );
  console.log(`결과 저장: ${path.relative(root, outputPath)} (${output.entries.length}곳 누적)`);
  console.log(
    `이번 실행: ${processed}곳 · 추정 누적 비용 $${totals.estimatedCostUsd.toFixed(4)} / $${maxSpendUsd.toFixed(2)} 상한 · 입력 ${totals.inputTokens.toLocaleString()} / 출력 ${totals.outputTokens.toLocaleString()} 토큰`,
  );
  console.log('번역 후보는 검토용으로만 저장되며 승인 상태의 번역만 앱 카탈로그에 반영됩니다.');
  if (processed < batch.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
