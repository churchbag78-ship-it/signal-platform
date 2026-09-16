/**
 * Page retrieval and passage verification.
 *
 * The pipeline this completes:
 *
 *   search result → retrieved page → ClaimExtractor → source classification
 *   → identity gate → Fact
 *
 * A search snippet is a third party's summary of a page. A retrieved page is
 * the page. The engine must never score one as the other, so a claim only
 * earns `page_retrieved` when its supporting passage is actually found in the
 * retrieved body — and when it is not, the mismatch is RECORDED rather than
 * quietly downgraded and forgotten.
 *
 * Retrieval is an interface because it needs the network. Where retrieval is
 * unavailable, `NullPageRetriever` says so explicitly and every claim stays at
 * snippet level; nothing is silently promoted.
 */

import type { IsoDate, Verification } from '../domain.ts';
import type { ProviderOperation } from '../providers/registry.ts';

export interface RetrievedPage {
  url: string;
  /** Final URL after redirects, when it differs. */
  finalUrl?: string;
  status: number;
  contentType?: string;
  /** Extracted body text. */
  text: string;
  retrievedAt: IsoDate;
  /** Stable hash of the body, so a re-run can tell if the page changed. */
  contentHash: string;
}

export type RetrievalOutcome =
  | { status: 'retrieved'; page: RetrievedPage }
  | { status: 'unavailable'; url: string; reason: string }
  | { status: 'failed'; url: string; reason: string; httpStatus?: number };

export interface PageRetriever {
  readonly id: string;
  describe(): ProviderOperation;
  retrieve(url: string): Promise<RetrievalOutcome>;
}

/** Cheap, stable content hash — enough to detect a changed page between runs. */
export function contentHash(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + code, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

/** Strips markup and collapses whitespace. Not a full HTML parser. */
export function extractText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normaliseForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9'"%£$.,\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface PassageCheck {
  /** True when the passage is present in the page, verbatim or near enough. */
  supported: boolean;
  /** Share of the passage's distinctive tokens found in the page, 0-1. */
  overlap: number;
  method: 'verbatim' | 'token_overlap' | 'absent';
}

const OVERLAP_THRESHOLD = 0.75;

/**
 * Does the retrieved page actually contain the passage the claim rests on?
 *
 * Extractors paraphrase and pages carry boilerplate, so an exact match is too
 * strict; but a low bar would let an invented passage through, which is the
 * failure this exists to catch. Verbatim first, then distinctive-token overlap.
 */
export function passageSupportedByPage(passage: string, page: RetrievedPage): PassageCheck {
  const haystack = normaliseForComparison(page.text);
  const needle = normaliseForComparison(passage);

  if (!needle) return { supported: false, overlap: 0, method: 'absent' };
  if (haystack.includes(needle)) return { supported: true, overlap: 1, method: 'verbatim' };

  const tokens = needle.split(' ').filter((t) => t.length > 3);
  if (tokens.length === 0) return { supported: false, overlap: 0, method: 'absent' };

  const found = tokens.filter((t) => haystack.includes(t)).length;
  const overlap = found / tokens.length;

  return {
    supported: overlap >= OVERLAP_THRESHOLD,
    overlap,
    method: overlap > 0 ? 'token_overlap' : 'absent',
  };
}

export interface VerificationResult {
  url: string;
  /** The level the evidence has EARNED, never what was hoped for. */
  level: Verification;
  outcome: RetrievalOutcome['status'];
  /** Present when a page was retrieved. */
  passage?: PassageCheck;
  /** Why the claim did not reach page level, when it did not. */
  failure?: string;
}

/**
 * Establishes the evidence level for one claim. A claim reaches
 * `page_retrieved` only if the page was fetched AND the passage was found in
 * it. Anything else stays `search_snippet` with the reason recorded.
 */
export async function verifyClaimPassage(
  sourceUrl: string,
  supportingPassage: string,
  retriever: PageRetriever,
): Promise<VerificationResult> {
  const outcome = await retriever.retrieve(sourceUrl);

  if (outcome.status !== 'retrieved') {
    return {
      url: sourceUrl,
      level: 'search_snippet',
      outcome: outcome.status,
      failure: outcome.reason,
    };
  }

  const passage = passageSupportedByPage(supportingPassage, outcome.page);

  if (!passage.supported) {
    return {
      url: sourceUrl,
      level: 'search_snippet',
      outcome: 'retrieved',
      passage,
      failure:
        `the page was retrieved but does not contain the supporting passage ` +
        `(${Math.round(passage.overlap * 100)}% token overlap) — the claim may be paraphrased ` +
        'beyond recognition, or invented',
    };
  }

  return { url: sourceUrl, level: 'page_retrieved', outcome: 'retrieved', passage };
}

// --- implementations -------------------------------------------------------

export interface HttpRetrieverConfig {
  providerId?: string;
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
  costPerFetch?: number;
}

/** The real retriever. Works wherever outbound HTTP is permitted. */
export class HttpPageRetriever implements PageRetriever {
  readonly id: string;
  readonly #config: Required<Omit<HttpRetrieverConfig, 'providerId'>>;
  readonly #fetch: typeof globalThis.fetch;
  #fetches = 0;

  constructor(config: HttpRetrieverConfig = {}, fetchImpl: typeof globalThis.fetch = globalThis.fetch) {
    this.id = config.providerId ?? 'http-retriever';
    this.#config = {
      timeoutMs: config.timeoutMs ?? 20_000,
      maxBytes: config.maxBytes ?? 2_000_000,
      userAgent: config.userAgent ?? 'SignalResearchBot/0.1',
      costPerFetch: config.costPerFetch ?? 0,
    };
    this.#fetch = fetchImpl;
  }

  get fetches(): number {
    return this.#fetches;
  }

  describe(): ProviderOperation {
    return {
      providerId: this.id,
      operation: 'http.retrieve_page',
      dataType: 'web_page',
      cost: { credits: this.#config.costPerFetch },
      availability: 'available',
      confidence: 0.9,
    };
  }

  async retrieve(url: string): Promise<RetrievalOutcome> {
    try {
      const response = await this.#fetch(url, {
        headers: { 'user-agent': this.#config.userAgent, accept: 'text/html,*/*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(this.#config.timeoutMs),
      });

      if (!response.ok) {
        return {
          status: 'failed',
          url,
          reason: `HTTP ${response.status}`,
          httpStatus: response.status,
        };
      }

      const contentType = response.headers.get('content-type') ?? undefined;
      const raw = await response.text();
      const body = raw.length > this.#config.maxBytes ? raw.slice(0, this.#config.maxBytes) : raw;
      const text = /json|text\/plain/.test(contentType ?? '') ? body : extractText(body);

      this.#fetches += 1;

      return {
        status: 'retrieved',
        page: {
          url,
          ...(response.url && response.url !== url ? { finalUrl: response.url } : {}),
          status: response.status,
          ...(contentType ? { contentType } : {}),
          text,
          retrievedAt: new Date().toISOString().slice(0, 10),
          contentHash: contentHash(text),
        },
      };
    } catch (error) {
      return {
        status: 'failed',
        url,
        reason: error instanceof Error ? error.message : 'unknown retrieval error',
      };
    }
  }
}

/**
 * The default where retrieval is not possible. It never pretends: every claim
 * stays at snippet level and each attempt records why.
 */
export class NullPageRetriever implements PageRetriever {
  readonly id = 'null-retriever';
  readonly #reason: string;
  readonly attempted: string[] = [];

  constructor(reason = 'no page retriever configured in this environment') {
    this.#reason = reason;
  }

  describe(): ProviderOperation {
    return {
      providerId: this.id,
      operation: 'null.retrieve_page',
      dataType: 'web_page',
      cost: { credits: 0 },
      availability: 'blocked',
      confidence: 0,
    };
  }

  async retrieve(url: string): Promise<RetrievalOutcome> {
    this.attempted.push(url);
    return { status: 'unavailable', url, reason: this.#reason };
  }
}

/** Replays pages captured elsewhere, for testing the verification path. */
export class FixturePageRetriever implements PageRetriever {
  readonly id = 'fixture-retriever';
  readonly #pages: Map<string, RetrievedPage>;
  readonly requested: string[] = [];

  constructor(pages: RetrievedPage[]) {
    this.#pages = new Map(pages.map((p) => [p.url, p]));
  }

  describe(): ProviderOperation {
    return {
      providerId: this.id,
      operation: 'fixture.retrieve_page',
      dataType: 'web_page',
      cost: { credits: 0 },
      availability: 'available',
      confidence: 0.5,
    };
  }

  async retrieve(url: string): Promise<RetrievalOutcome> {
    this.requested.push(url);
    const page = this.#pages.get(url);
    if (!page) {
      return { status: 'unavailable', url, reason: 'no fixture page captured for this URL' };
    }
    return { status: 'retrieved', page };
  }
}
