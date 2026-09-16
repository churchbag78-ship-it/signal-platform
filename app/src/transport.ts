/**
 * Everything that needs the outside world, behind three small interfaces.
 *
 * There are exactly three external dependencies in this product: a search
 * engine, a page fetcher, and a model. Each gets one interface and two
 * implementations — the real one, and a bridge that replays work an agent
 * did on the process's behalf.
 *
 * Why the bridge exists, stated plainly so nobody mistakes it for a fixture:
 * this development environment's egress policy refuses CONNECT with HTTP 403
 * for every host, and carries no model credential (`api.anthropic.com` answers
 * and returns 401). The Node process therefore cannot search, fetch or reason.
 * The agent driving the session CAN. So the real research is performed against
 * the real web, recorded, and replayed through these classes — which means the
 * engine, the prompts, the parsing and every downstream check are exercised on
 * genuine material, while the HTTP calls themselves are not.
 *
 * The rule that keeps a bridge run honest, inherited from
 * `engine/src/research/agent-bridge.ts`: a missing capture is an ERROR, never
 * an empty result. Silently returning nothing would manufacture "we looked and
 * found nothing", which is the one negative that must always be real.
 */

import { readFileSync } from 'node:fs';
import type { SearchClient, SearchResult } from '../../engine/src/research/types.ts';
import {
  contentHash,
  extractText,
  type PageRetriever,
  type RetrievalOutcome,
} from '../../engine/src/research/retrieval.ts';
import type { ProviderOperation } from '../../engine/src/providers/registry.ts';

// --- the model -------------------------------------------------------------

export interface ModelRequest {
  /** Stable name for the call site, e.g. "commercial-model". Used by the bridge. */
  purpose: string;
  system: string;
  user: string;
  maxTokens?: number;
}

export interface ModelClient {
  readonly id: string;
  complete(request: ModelRequest): Promise<string>;
  readonly callsMade: number;
}

export interface AnthropicConfig {
  apiKey: string;
  model: string;
  endpoint?: string;
  timeoutMs?: number;
}

export class AnthropicModelClient implements ModelClient {
  readonly id: string;
  #calls = 0;
  readonly #config: AnthropicConfig;
  readonly #fetch: typeof globalThis.fetch;

  constructor(config: AnthropicConfig, fetchImpl: typeof globalThis.fetch = globalThis.fetch) {
    this.#config = config;
    this.#fetch = fetchImpl;
    this.id = `anthropic:${config.model}`;
  }

  get callsMade(): number {
    return this.#calls;
  }

  async complete(request: ModelRequest): Promise<string> {
    this.#calls += 1;
    const response = await this.#fetch(this.#config.endpoint ?? 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.#config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.#config.model,
        max_tokens: request.maxTokens ?? 4096,
        system: request.system,
        messages: [{ role: 'user', content: request.user }],
      }),
      signal: AbortSignal.timeout(this.#config.timeoutMs ?? 120_000),
    });

    if (!response.ok) {
      // Loud, always. A silent empty completion is indistinguishable from a
      // model that considered the question and had nothing to say.
      throw new Error(
        `model returned HTTP ${response.status} for ${request.purpose}: ${(await response.text()).slice(0, 300)}`,
      );
    }

    const payload = (await response.json()) as { content?: { text?: string }[] };
    const text = payload.content?.map((part) => part.text ?? '').join('') ?? '';
    if (!text.trim()) throw new Error(`model returned an empty response for ${request.purpose}`);
    return text;
  }
}

// --- the capture file ------------------------------------------------------

export interface Capture {
  capturedAt: string;
  /** What executed the work: a tool name, a person, a script. */
  transport: string;
  searches: { query: string; results: Omit<SearchResult, 'query'>[] }[];
  pages: { url: string; text: string; retrievedAt: string; status?: number }[];
  /** Model responses, keyed by `purpose` then by call index within that purpose. */
  model: { purpose: string; response: string }[];
}

export function emptyCapture(transport: string): Capture {
  return {
    capturedAt: new Date().toISOString().slice(0, 10),
    transport,
    searches: [],
    pages: [],
    model: [],
  };
}

export function loadCapture(path: string): Capture {
  return JSON.parse(readFileSync(path, 'utf8')) as Capture;
}

// --- bridge implementations ------------------------------------------------

function normaliseQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

export class BridgeSearchClient implements SearchClient {
  readonly id = 'bridge-search';
  readonly requested: string[] = [];
  readonly #byQuery = new Map<string, SearchResult[]>();

  constructor(capture: Capture) {
    for (const entry of capture.searches) {
      this.#byQuery.set(
        normaliseQuery(entry.query),
        entry.results.map((result) => ({ ...result, query: entry.query })),
      );
    }
  }

  async search(query: string): Promise<SearchResult[]> {
    this.requested.push(query);
    const captured = this.#byQuery.get(normaliseQuery(query));
    if (captured === undefined) {
      throw new Error(
        `no capture for query ${JSON.stringify(query)}. Run it and add it to the capture file — ` +
          'an uncaptured query must never be reported as "found nothing".',
      );
    }
    return captured;
  }

  unusedCaptures(): string[] {
    const asked = new Set(this.requested.map(normaliseQuery));
    return [...this.#byQuery.keys()].filter((q) => !asked.has(q));
  }
}

export class BridgePageRetriever implements PageRetriever {
  readonly id = 'bridge-page';
  readonly requested: string[] = [];
  readonly #pages: Map<string, { text: string; retrievedAt: string; status: number }>;

  constructor(capture: Capture) {
    this.#pages = new Map(
      capture.pages.map((page) => [
        page.url,
        { text: page.text, retrievedAt: page.retrievedAt, status: page.status ?? 200 },
      ]),
    );
  }

  describe(): ProviderOperation {
    return {
      providerId: this.id,
      operation: 'bridge.retrieve_page',
      dataType: 'web_page',
      cost: { credits: 0 },
      availability: 'available',
      // The body is a real page fetched by the agent, but this process did not
      // fetch it, so the chain of custody is one step longer than a live run.
      confidence: 0.75,
    };
  }

  async retrieve(url: string): Promise<RetrievalOutcome> {
    this.requested.push(url);
    const page = this.#pages.get(url);
    if (!page) {
      // NOT an error: a page nobody captured is genuinely unavailable to this
      // run, and the engine already knows how to record that without promoting
      // the claim. Queries are different — an unrun query is a coverage lie.
      return { status: 'unavailable', url, reason: 'no page captured for this URL in this run' };
    }
    return {
      status: 'retrieved',
      page: {
        url,
        status: page.status,
        text: page.text,
        retrievedAt: page.retrievedAt,
        contentHash: contentHash(page.text),
      },
    };
  }
}

export class BridgeModelClient implements ModelClient {
  readonly id = 'bridge-model';
  #calls = 0;
  readonly #queues = new Map<string, string[]>();
  readonly #used: string[] = [];

  constructor(capture: Capture) {
    for (const entry of capture.model) {
      const queue = this.#queues.get(entry.purpose) ?? [];
      queue.push(entry.response);
      this.#queues.set(entry.purpose, queue);
    }
  }

  get callsMade(): number {
    return this.#calls;
  }

  get used(): string[] {
    return [...this.#used];
  }

  async complete(request: ModelRequest): Promise<string> {
    const queue = this.#queues.get(request.purpose);
    if (!queue || queue.length === 0) {
      throw new Error(
        `no captured model response for purpose ${JSON.stringify(request.purpose)} ` +
          `(call ${this.#calls + 1}). Record one and add it to the capture file.`,
      );
    }
    this.#calls += 1;
    this.#used.push(request.purpose);
    return queue.shift()!;
  }
}

// --- real search -----------------------------------------------------------

export interface SearchConfig {
  providerId: string;
  /** `{query}` is replaced with the URL-encoded query. */
  endpoint: string;
  authHeader?: string;
  apiKey?: string;
  /** Dotted path to the results array, e.g. "web.results". */
  resultsPath: string;
  fields: { title: string; url: string; snippet: string };
  timeoutMs?: number;
}

/**
 * Two presets, not five. A provider abstraction zoo is a way of avoiding the
 * question of which one actually works; these are the two whose shapes are
 * documented and whose free tiers make a first run affordable.
 */
export const SEARCH_PRESETS: Record<string, Omit<SearchConfig, 'apiKey'>> = {
  brave: {
    providerId: 'brave',
    endpoint: 'https://api.search.brave.com/res/v1/web/search?q={query}&count=20',
    authHeader: 'X-Subscription-Token',
    resultsPath: 'web.results',
    fields: { title: 'title', url: 'url', snippet: 'description' },
  },
  serper: {
    providerId: 'serper',
    endpoint: 'https://google.serper.dev/search?q={query}&num=20',
    authHeader: 'X-API-KEY',
    resultsPath: 'organic',
    fields: { title: 'title', url: 'link', snippet: 'snippet' },
  },
};

function dig(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (value, key) => (value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined),
    source,
  );
}

export class HttpSearchClient implements SearchClient {
  readonly id: string;
  readonly requested: string[] = [];
  readonly #config: SearchConfig;
  readonly #fetch: typeof globalThis.fetch;

  constructor(config: SearchConfig, fetchImpl: typeof globalThis.fetch = globalThis.fetch) {
    this.#config = config;
    this.#fetch = fetchImpl;
    this.id = config.providerId;
  }

  async search(query: string): Promise<SearchResult[]> {
    this.requested.push(query);
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.#config.authHeader && this.#config.apiKey) {
      headers[this.#config.authHeader] = this.#config.apiKey;
    }

    const response = await this.#fetch(
      this.#config.endpoint.replace('{query}', encodeURIComponent(query)),
      { headers, signal: AbortSignal.timeout(this.#config.timeoutMs ?? 30_000) },
    );

    if (!response.ok) {
      // Throwing is correct: the engine records an unexecutable query as a
      // coverage failure, which is true, rather than as a finding, which is not.
      throw new Error(`search provider ${this.#config.providerId} returned ${response.status}`);
    }

    const body = await response.json();
    const rows = dig(body, this.#config.resultsPath);
    if (!Array.isArray(rows)) return [];

    const today = new Date().toISOString().slice(0, 10);
    return rows
      .map((row) => {
        const record = row as Record<string, unknown>;
        return {
          query,
          title: String(record[this.#config.fields.title] ?? ''),
          url: String(record[this.#config.fields.url] ?? ''),
          snippet: String(record[this.#config.fields.snippet] ?? ''),
          retrievedAt: today,
        };
      })
      .filter((result) => result.url.startsWith('http'));
  }
}

/** The real page fetcher. Re-exported here so callers need one import. */
export { HttpPageRetriever } from '../../engine/src/research/retrieval.ts';
export { extractText };
