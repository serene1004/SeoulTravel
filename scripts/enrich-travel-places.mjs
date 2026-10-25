import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env.local');
const catalogPath = path.join(root, 'src/data/seoul-travel-places.json');
const outputPath = path.join(root, 'src/data/seoul-travel-place-enrichment.json');
const envText = await readFile(envPath, 'utf8').catch(() => '');
const model = process.env.OPENAI_MODEL || getEnvValue(envText, 'OPENAI_MODEL') || 'gpt-5.4-mini';
const maxSpendUsd = Number(
  process.env.ENRICH_MAX_SPEND_USD || getEnvValue(envText, 'ENRICH_MAX_SPEND_USD') || 4.5,
);
const tokenRatesPerMillion = {
  'gpt-5-mini': { input: 0.25, output: 2 },
  'gpt-5.4-mini': { input: 0.75, output: 4.5 },
  'gpt-5.6-luna': { input: 0.2, output: 1.2 },
  'gpt-5.6-terra': { input: 2, output: 12 },
  'gpt-6-luna': { input: 0.1, output: 0.5 },
};
const webSearchCallCostUsd = 0.01;
const requestCostReserveUsd = 0.03;
const fields = ['address', 'hours', 'closedDays', 'transport', 'officialUrl'];

function getEnvValue(envText, name) {
  const line = envText.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  const value = line?.slice(name.length + 1).trim();
  return value?.replace(
    /^(?:"(.*)"|'(.*)')$/,
    (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted,
  );
}

export function estimateCostUsd(usage, searchCalls, modelName) {
  const rates = tokenRatesPerMillion[modelName];
  if (!rates) throw new Error(`비용 추정에 등록되지 않은 모델입니다: ${modelName}`);
  return (
    ((usage.input_tokens || 0) * rates.input + (usage.output_tokens || 0) * rates.output) /
      1_000_000 +
    searchCalls * webSearchCallCostUsd
  );
}

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'fields', 'sources', 'notes'],
  properties: {
    status: { type: 'string', enum: ['verified', 'partial', 'not_found', 'ambiguous'] },
    fields: {
      type: 'object',
      additionalProperties: false,
      required: fields,
      properties: Object.fromEntries(
        fields.map((field) => [
          field,
          {
            type: 'object',
            additionalProperties: false,
            required: ['value', 'sourceUrl'],
            properties: {
              value: { type: ['string', 'null'] },
              sourceUrl: { type: ['string', 'null'] },
            },
          },
        ]),
      ),
    },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['url', 'title', 'type'],
        properties: {
          url: { type: 'string' },
          title: { type: 'string' },
          type: { type: 'string', enum: ['official', 'public', 'secondary'] },
        },
      },
    },
    notes: { type: 'string' },
  },
};

function readArgs(args) {
  const options = { limit: 25, offset: 0, dryRun: false, force: false };
  args = args.filter((arg) => arg !== '--');
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
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

function searchSourceUrls(response) {
  const urls = new Set();
  for (const item of response.output || []) {
    for (const source of item.action?.sources || []) {
      if (source.url) urls.add(source.url);
    }
    for (const content of item.content || []) {
      for (const annotation of content.annotations || []) {
        if (annotation.url) urls.add(annotation.url);
      }
    }
  }
  return urls;
}

export function validateEnrichment(result, foundUrls) {
  const sources = result.sources.filter((source) => foundUrls.has(source.url));
  const validSources = new Map(sources.map((source) => [source.url, source]));
  const enrichedFields = Object.fromEntries(
    fields.map((field) => {
      const suggestion = result.fields[field];
      const source = suggestion.sourceUrl && validSources.get(suggestion.sourceUrl);
      return [
        field,
        source && suggestion.value?.trim()
          ? { value: suggestion.value.trim(), sourceUrl: source.url, sourceType: source.type }
          : { value: null, sourceUrl: null, sourceType: null },
      ];
    }),
  );
  const populated = fields.filter((field) => enrichedFields[field].value).length;
  return {
    status:
      populated === fields.length
        ? 'review_required'
        : populated
          ? 'partial_review_required'
          : 'not_found',
    fields: enrichedFields,
    sources,
    notes: result.notes,
  };
}

function responseText(response) {
  return (response.output || [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .find((item) => item.type === 'output_text')?.text;
}

async function requestPlace(place, apiKey) {
  const input = [
    '서울 관광 장소의 방문 정보를 웹 검색으로 조사하세요.',
    '공식 장소 사이트를 최우선으로 하고, 없으면 서울시·공공기관 출처를 사용하세요. 보조 출처만 있으면 type을 secondary로 표시하세요.',
    '주소, 운영시간, 휴무일, 대중교통, 공식 URL을 확인하고 각 값마다 실제 검색 출처 URL을 연결하세요.',
    '검색 결과에서 확인되지 않은 값은 null로 두세요. 추정하거나 다른 지점의 정보를 섞지 마세요.',
    '공식 출처 간 정보가 다르거나 장소 일치가 불확실하면 ambiguous로 표시하고 notes에 이유를 쓰세요.',
    '장소:',
    JSON.stringify({
      name: place.name,
      address: place.address,
      district: place.district,
      placeType: place.placeType,
      currentOfficialUrl: place.officialUrl,
    }),
  ].join('\n');

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model,
        max_output_tokens: 1800,
        max_tool_calls: 1,
        reasoning: { effort: 'none' },
        tools: [{ type: 'web_search', search_context_size: 'low' }],
        tool_choice: 'required',
        include: ['web_search_call.action.sources'],
        text: { format: { type: 'json_schema', name: 'place_enrichment', strict: true, schema } },
        input,
      }),
    });
    if (response.ok) {
      const payload = await response.json();
      const text = responseText(payload);
      if (!text) throw new Error('AI 응답에서 구조화된 결과를 찾지 못했습니다.');
      return {
        enrichment: validateEnrichment(JSON.parse(text), searchSourceUrls(payload)),
        usage: payload.usage ?? null,
        searchCalls: (payload.output || []).filter((item) => item.type === 'web_search_call')
          .length,
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
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const output = await readFile(outputPath, 'utf8')
    .then(JSON.parse)
    .catch(() => ({
      schemaVersion: 1,
      sourceCatalog: 'seoul-travel-places.json',
      entries: [],
    }));
  output.model = model;
  const completedIds = new Set(output.entries.map((entry) => entry.id));
  const candidates = catalog.places
    .filter((place) => place.operatingStatus !== 'official_information_found')
    .slice(options.offset, options.offset + options.limit)
    .filter((place) => options.force || !completedIds.has(place.id));

  if (!candidates.length) {
    console.log('처리할 장소가 없습니다. --force 또는 다른 --offset을 사용하세요.');
    return;
  }
  if (options.dryRun) {
    console.log(`배치 준비 완료: ${candidates.length}곳 (offset ${options.offset})`);
    for (const place of candidates) console.log(`${place.id}\t${place.name}\t${place.district}`);
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY || getEnvValue(envText, 'OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY가 필요합니다. 키는 저장소 파일에 기록하지 마세요.');
  if (!tokenRatesPerMillion[model])
    throw new Error(`비용 추정에 등록되지 않은 모델입니다: ${model}`);
  if (!Number.isFinite(maxSpendUsd) || maxSpendUsd <= 0) {
    throw new Error('ENRICH_MAX_SPEND_USD에는 0보다 큰 금액을 지정하세요.');
  }

  for (const [index, place] of candidates.entries()) {
    const knownSpendUsd = output.entries.reduce(
      (sum, entry) => sum + (entry.estimatedCostUsd || 0),
      0,
    );
    if (knownSpendUsd + requestCostReserveUsd >= maxSpendUsd) {
      console.log(
        `비용 안전 상한으로 중단합니다: $${knownSpendUsd.toFixed(3)} / $${maxSpendUsd.toFixed(2)}`,
      );
      break;
    }
    try {
      const { enrichment, usage, searchCalls } = await requestPlace(place, apiKey);
      if (!usage) {
        const error = new Error('응답에 토큰 사용량이 없어 비용을 계산할 수 없습니다.');
        error.stopBatch = true;
        throw error;
      }
      const estimatedCostUsd = estimateCostUsd(usage, searchCalls, model);
      output.entries = output.entries.filter((entry) => entry.id !== place.id);
      output.entries.push({
        id: place.id,
        sourceId: place.sourceId,
        name: place.name,
        district: place.district,
        current: Object.fromEntries(fields.map((field) => [field, place[field] || null])),
        researchedAt: new Date().toISOString().slice(0, 10),
        model,
        usage,
        searchCalls,
        estimatedCostUsd,
        ...enrichment,
      });
      await save(output);
      console.log(`[${index + 1}/${candidates.length}] ${place.name}: ${enrichment.status}`);
    } catch (error) {
      console.error(`[${index + 1}/${candidates.length}] ${place.name}: ${error.message}`);
      if (error.stopBatch) {
        console.error(
          '크레딧 또는 사용 한도 오류로 배치를 중단합니다. 잔액을 확인한 뒤 다시 실행하세요.',
        );
        break;
      }
    }
    if (index < candidates.length - 1) await new Promise((resolve) => setTimeout(resolve, 800));
  }
  const totals = output.entries.reduce(
    (sum, entry) => ({
      inputTokens: sum.inputTokens + (entry.usage?.input_tokens || 0),
      outputTokens: sum.outputTokens + (entry.usage?.output_tokens || 0),
      searchCalls: sum.searchCalls + (entry.searchCalls || 0),
      estimatedCostUsd: sum.estimatedCostUsd + (entry.estimatedCostUsd || 0),
    }),
    { inputTokens: 0, outputTokens: 0, searchCalls: 0, estimatedCostUsd: 0 },
  );
  console.log(`결과 저장: ${path.relative(root, outputPath)} (${output.entries.length}개 누적)`);
  console.log(
    `추적된 누적 비용: $${totals.estimatedCostUsd.toFixed(3)} / $${maxSpendUsd.toFixed(2)} 상한 · ${totals.searchCalls}회 검색 · 입력 ${totals.inputTokens.toLocaleString()} / 출력 ${totals.outputTokens.toLocaleString()} 토큰`,
  );
  console.log('제안 결과는 검토용이며, 승인 전에는 앱 카탈로그를 변경하지 않습니다.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
