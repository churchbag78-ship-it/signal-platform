/**
 * LLM-backed claim extraction.
 *
 * The model reads search results and returns structured claims. It is given no
 * way to assert attribution: the schema has no "this is the target" field, only
 * attribute fields, and everything it returns is re-validated here before the
 * engine's identity gate sees it.
 *
 * Provider-agnostic — endpoint, model and key are configuration, and the
 * transport is injected so the whole path is testable without a key or network.
 */

import type { IsoDate } from '../domain.ts';
import type { ProviderOperation } from '../providers/registry.ts';
import type { ClaimTopic } from './registry.ts';
import {
  validateExtractedClaim,
  type ExtractedClaim,
  type SignalPolarity,
} from './extraction.ts';
import type { ClaimExtractor, ExtractionRequest, ExtractionOutput, SearchResult } from './types.ts';

export interface LlmConfig {
  providerId: string;
  endpoint: string;
  model: string;
  apiKey?: string;
  authHeader?: string;
  /** Extra headers a provider requires, e.g. an API version. */
  headers?: Record<string, string>;
  maxTokens?: number;
  timeoutMs?: number;
  /** Cost per extraction call, for the ledger. */
  costPerCall?: number;
}

export const LLM_PRESETS: Record<string, Omit<LlmConfig, 'apiKey' | 'model'>> = {
  anthropic: {
    providerId: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    authHeader: 'x-api-key',
    headers: { 'anthropic-version': '2023-06-01' },
    maxTokens: 4096,
    costPerCall: 1,
  },
};

/**
 * The extraction contract, stated to the model. The prohibitions are the
 * important half: they are what keep the model out of the identity decision.
 */
export const EXTRACTION_SYSTEM_PROMPT = `You extract structured commercial evidence from web search results.

You return CLAIMS, not conclusions. A claim is something a source states.

For every claim you must supply:
- claimText: what the source states, quoted or closely paraphrased
- supportingPassage: the passage you read it from
- sourceUrl: the exact URL
- topic: one of corporate_identity, financials, funding, contract_win, premises,
  hiring, leadership, export_trade, product, restructuring, regulatory, general
- publicationDate and eventDate in YYYY-MM-DD where the source gives them.
  The event date is when the thing happened. Never substitute the publication
  date for it, and omit either if the source does not state it.
- identityAttributes: what the SOURCE says about the company it discusses —
  statedName, statedDomain, statedGeography {country, region, town},
  statedIndustry, statedDescriptors, statedCompanyNumber
- extractionConfidence: 0-1, how sure you are you read the source correctly
- verification: 'page_retrieved' if you read the page, 'search_snippet' if
  you only saw a search summary
- originId: set the same value on claims that come from one press release
- demandImpacts: how THIS CLAIM moves demand for the client's offerings, as a
  list of {offering, effect, rationale}. Use the client's own wording for the
  offering. effect is 'increases', 'reduces' or 'neutral'. Give one entry per
  offering the claim actually bears on, and none where it bears on nothing.
  Judge each offering separately: a company opening its own distribution centre
  REDUCES demand for third-party warehousing while it may increase demand for
  haulage, and both belong here. Do not record an effect the claim does not
  support, and do not name an offering the client does not sell.

You must NOT decide whether a source is about the target company. There is no
field for that. Report what the source says about whichever company it
discusses, and let the engine compare. If a result is plainly about a different
company with a similar name, still extract it with the attributes you read —
including the geography and industry that make it different.

You must NOT invent a source, a date, a figure or a passage. If a source does
not state something, omit the field.

Separately from the claims, give:
- trigger: a short signal type, e.g. export_finance, new_premises, contraction
- whatChanged: one sentence
- polarity: demand_increasing, demand_reducing or neutral FOR THIS CLIENT
- polarityRationale: why, in one sentence. This is your judgement, not evidence.

The engine derives the direction it scores from your per-claim demandImpacts,
not from your polarity label. Your polarity is a cross-check: where the two
disagree, the engine records the disagreement and scores the evidence.

Return a single JSON object with keys: claims, trigger, whatChanged, polarity,
polarityRationale. Return nothing else.`;

export interface LlmTransport {
  (url: string, init: RequestInit): Promise<Response>;
}

interface LlmExtractionPayload {
  claims?: unknown[];
  trigger?: string;
  whatChanged?: string;
  polarity?: string;
  polarityRationale?: string;
}

const TOPICS = new Set<ClaimTopic>([
  'corporate_identity', 'financials', 'funding', 'contract_win', 'premises',
  'hiring', 'leadership', 'export_trade', 'product', 'restructuring',
  'regulatory', 'general',
]);

const POLARITIES = new Set<SignalPolarity>([
  'demand_increasing', 'demand_reducing', 'neutral',
]);

/** Extracts the first JSON object from a model response. */
export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('model response contained no JSON object');
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

/**
 * Coerces one model-produced claim into the schema, dropping anything the
 * model was not entitled to decide. Returns null when the claim cannot be
 * trusted at all.
 */
export function coerceClaim(raw: unknown, index: number): ExtractedClaim | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;

  const str = (key: string): string | undefined => {
    const value = record[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  };

  const attributesRaw = (record.identityAttributes ?? {}) as Record<string, unknown>;
  const geographyRaw = (attributesRaw.statedGeography ?? {}) as Record<string, unknown>;
  const geoField = (key: string): string | undefined =>
    typeof geographyRaw[key] === 'string' && geographyRaw[key] ? (geographyRaw[key] as string) : undefined;

  const attributeString = (key: string): string | undefined =>
    typeof attributesRaw[key] === 'string' && (attributesRaw[key] as string).trim()
      ? (attributesRaw[key] as string).trim()
      : undefined;

  const geography = {
    ...(geoField('country') ? { country: geoField('country')! } : {}),
    ...(geoField('region') ? { region: geoField('region')! } : {}),
    ...(geoField('town') ? { town: geoField('town')! } : {}),
  };

  const topicRaw = str('topic') as ClaimTopic | undefined;
  const confidence = typeof record.extractionConfidence === 'number'
    ? Math.max(0, Math.min(1, record.extractionConfidence))
    : 0.5;

  const claim: ExtractedClaim = {
    id: str('id') ?? `claim-${index + 1}`,
    claimText: str('claimText') ?? '',
    supportingPassage: str('supportingPassage') ?? '',
    sourceUrl: str('sourceUrl') ?? '',
    ...(str('statedSourceType') ? { statedSourceType: str('statedSourceType')! } : {}),
    ...(str('publicationDate') ? { publicationDate: str('publicationDate')! } : {}),
    ...(str('eventDate') ? { eventDate: str('eventDate')! } : {}),
    topic: topicRaw && TOPICS.has(topicRaw) ? topicRaw : 'general',
    identityAttributes: {
      ...(attributeString('statedName') ? { statedName: attributeString('statedName')! } : {}),
      ...(attributeString('statedDomain') ? { statedDomain: attributeString('statedDomain')! } : {}),
      ...(Object.keys(geography).length > 0 ? { statedGeography: geography } : {}),
      ...(attributeString('statedIndustry') ? { statedIndustry: attributeString('statedIndustry')! } : {}),
      ...(attributeString('statedCompanyNumber')
        ? { statedCompanyNumber: attributeString('statedCompanyNumber')! }
        : {}),
      ...(Array.isArray(attributesRaw.statedDescriptors)
        ? {
            statedDescriptors: (attributesRaw.statedDescriptors as unknown[])
              .filter((d): d is string => typeof d === 'string'),
          }
        : {}),
    },
    extractionConfidence: confidence,
    ...(str('originId') ? { originId: str('originId')! } : {}),
    verification: record.verification === 'page_retrieved' ? 'page_retrieved' : 'search_snippet',
  };

  return validateExtractedClaim(claim).valid ? claim : null;
}

export interface LlmExtractionResult {
  claims: ExtractedClaim[];
  trigger: string;
  whatChanged: string;
  polarity: SignalPolarity;
  polarityRationale: string;
  /** Claims the model returned that failed validation and were discarded. */
  discarded: number;
}

export function buildExtractionPrompt(
  results: SearchResult[],
  clientName: string,
  targetName: string,
  runDate: IsoDate,
): string {
  const rendered = results
    .map(
      (r, i) =>
        `[${i + 1}] title: ${r.title}\n    url: ${r.url}\n    snippet: ${r.snippet}\n    retrieved: ${r.retrievedAt}`,
    )
    .join('\n\n');

  return [
    `Today is ${runDate}.`,
    `Client: ${clientName}. You are assessing whether anything has changed at "${targetName}".`,
    '',
    'Search results:',
    rendered || '(no results)',
  ].join('\n');
}

export class LlmClaimExtractor implements ClaimExtractor {
  readonly id: string;
  readonly #config: LlmConfig;
  readonly #transport: LlmTransport;
  #callsMade = 0;

  constructor(config: LlmConfig, transport: LlmTransport = globalThis.fetch) {
    this.id = `${config.providerId}:${config.model}`;
    this.#config = config;
    this.#transport = transport;
  }

  get callsMade(): number {
    return this.#callsMade;
  }

  describe(): ProviderOperation {
    return {
      providerId: this.#config.providerId,
      operation: `${this.#config.providerId}.extract_claims`,
      dataType: 'news',
      cost: { credits: this.#config.costPerCall ?? 1 },
      availability: this.#config.apiKey ? 'available' : 'unauthenticated',
      confidence: 0.7,
    };
  }

  /** Calls the model and returns validated claims. Never throws on bad JSON. */
  async extractClaims(request: ExtractionRequest): Promise<LlmExtractionResult> {
    const prompt = buildExtractionPrompt(
      request.results,
      request.client.name,
      request.company.name,
      request.runDate,
    );

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(this.#config.headers ?? {}),
    };
    if (this.#config.authHeader && this.#config.apiKey) {
      headers[this.#config.authHeader] = this.#config.apiKey;
    }

    const response = await this.#transport(this.#config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.#config.model,
        max_tokens: this.#config.maxTokens ?? 4096,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(this.#config.timeoutMs ?? 60_000),
    });

    if (!response.ok) {
      // Fail loudly: a silent empty extraction is indistinguishable from
      // "researched and found nothing".
      throw new Error(
        `extraction provider ${this.#config.providerId} returned ${response.status}`,
      );
    }

    this.#callsMade += 1;

    const body = (await response.json()) as { content?: { text?: string }[] };
    const text = body.content?.map((part) => part.text ?? '').join('') ?? '';
    const payload = parseJsonObject(text) as LlmExtractionPayload;

    const rawClaims = Array.isArray(payload.claims) ? payload.claims : [];
    const claims: ExtractedClaim[] = [];
    let discarded = 0;

    for (const [index, raw] of rawClaims.entries()) {
      const claim = coerceClaim(raw, index);
      if (claim) claims.push(claim);
      else discarded += 1;
    }

    const polarityRaw = payload.polarity as SignalPolarity | undefined;

    return {
      claims,
      trigger: payload.trigger?.trim() || 'unclassified',
      whatChanged: payload.whatChanged?.trim() || '',
      polarity: polarityRaw && POLARITIES.has(polarityRaw) ? polarityRaw : 'neutral',
      polarityRationale: payload.polarityRationale?.trim() || '',
      discarded,
    };
  }

  /**
   * The ClaimExtractor interface. Claim extraction alone cannot produce the
   * inference and hypothesis layers — those are reasoning, not reading — so a
   * caller wanting a full ExtractionOutput supplies them. This method exists so
   * an LLM extractor can be dropped into the pipeline once that reasoning step
   * is wired; today it reports that claims are available but the chain is not.
   */
  async extract(request: ExtractionRequest): Promise<ExtractionOutput | null> {
    const result = await this.extractClaims(request);
    if (result.claims.length === 0) return null;

    // Deliberately not fabricating an inference/hypothesis chain from claims
    // alone: a hypothesis invented here would be reasoning presented as
    // reading, which is exactly what the architecture forbids.
    throw new Error(
      `LlmClaimExtractor produced ${result.claims.length} claims for ` +
        `${request.company.domain} but cannot author the inference/hypothesis ` +
        'chain; use extractClaims() and supply the reasoning layer',
    );
  }
}

export function llmExtractorFromEnv(
  env: Record<string, string | undefined> = process.env,
): LlmClaimExtractor | null {
  const preset = env.SIGNAL_LLM_PROVIDER;
  const apiKey = env.SIGNAL_LLM_API_KEY;
  const model = env.SIGNAL_LLM_MODEL;

  if (!preset || !apiKey || !model) return null;

  const base = LLM_PRESETS[preset];
  if (!base) {
    throw new Error(
      `unknown extraction provider "${preset}"; expected one of ${Object.keys(LLM_PRESETS).join(', ')}`,
    );
  }

  return new LlmClaimExtractor({ ...base, model, apiKey });
}
