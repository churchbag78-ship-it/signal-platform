/**
 * Live search over an HTTP search API.
 *
 * Provider-agnostic by construction: the endpoint, auth header and response
 * shape are all configuration, because search providers are interchangeable
 * and Signal must never be welded to one. Brave, Serper, Tavily, Google CSE
 * and Bing all fit this shape.
 *
 * Cost is declared per operation, so the routing layer can decide whether a
 * query is worth running before it runs.
 */

import type { ProviderOperation } from '../providers/registry.ts';
import type { SearchClient, SearchResult } from './types.ts';

export interface HttpSearchConfig {
  providerId: string;
  /** `{query}` is replaced with the URL-encoded query. */
  endpoint: string;
  /** Header name to carry the API key, e.g. "X-Subscription-Token". */
  authHeader?: string;
  apiKey?: string;
  /** Dotted path to the results array, e.g. "web.results". */
  resultsPath: string;
  /** Field names within each result. */
  fields: { title: string; url: string; snippet: string };
  /** Credits or cash per query, for the cost ledger. */
  costPerQuery?: number;
  timeoutMs?: number;
}

/** Well-known shapes, so a caller does not have to work them out. */
export const SEARCH_PRESETS: Record<string, Omit<HttpSearchConfig, 'apiKey'>> = {
  brave: {
    providerId: 'brave',
    endpoint: 'https://api.search.brave.com/res/v1/web/search?q={query}',
    authHeader: 'X-Subscription-Token',
    resultsPath: 'web.results',
    fields: { title: 'title', url: 'url', snippet: 'description' },
    costPerQuery: 1,
  },
  serper: {
    providerId: 'serper',
    endpoint: 'https://google.serper.dev/search?q={query}',
    authHeader: 'X-API-KEY',
    resultsPath: 'organic',
    fields: { title: 'title', url: 'link', snippet: 'snippet' },
    costPerQuery: 1,
  },
};

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value && typeof value === 'object' && key in value) {
      return (value as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export class HttpSearchClient implements SearchClient {
  readonly id: string;
  readonly #config: HttpSearchConfig;
  readonly #fetch: typeof globalThis.fetch;
  #queriesRun = 0;

  constructor(config: HttpSearchConfig, fetchImpl: typeof globalThis.fetch = globalThis.fetch) {
    this.id = config.providerId;
    this.#config = config;
    this.#fetch = fetchImpl;
  }

  describe(): ProviderOperation {
    return {
      providerId: this.#config.providerId,
      operation: `${this.#config.providerId}.web_search`,
      dataType: 'news',
      cost: { credits: this.#config.costPerQuery ?? 0 },
      availability: this.#config.apiKey ? 'available' : 'unauthenticated',
      confidence: 0.6,
    };
  }

  get queriesRun(): number {
    return this.#queriesRun;
  }

  async search(query: string): Promise<SearchResult[]> {
    const retrievedAt = new Date().toISOString().slice(0, 10);
    const url = this.#config.endpoint.replace('{query}', encodeURIComponent(query));

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.#config.authHeader && this.#config.apiKey) {
      headers[this.#config.authHeader] = this.#config.apiKey;
    }

    const response = await this.#fetch(url, {
      headers,
      signal: AbortSignal.timeout(this.#config.timeoutMs ?? 15_000),
    });

    if (!response.ok) {
      // Fail loudly. A silent empty result set is indistinguishable from
      // "researched and found nothing", and that distinction is the whole
      // point of recording negatives.
      throw new Error(
        `search provider ${this.#config.providerId} returned ${response.status} for "${query}"`,
      );
    }

    this.#queriesRun += 1;

    const body: unknown = await response.json();
    const rows = readPath(body, this.#config.resultsPath);
    if (!Array.isArray(rows)) return [];

    return rows.map((row): SearchResult => {
      const record = (row ?? {}) as Record<string, unknown>;
      return {
        query,
        title: asString(record[this.#config.fields.title]),
        url: asString(record[this.#config.fields.url]),
        snippet: asString(record[this.#config.fields.snippet]),
        retrievedAt,
      };
    });
  }
}

/** Builds a client from environment configuration, or null when unconfigured. */
export function searchClientFromEnv(
  env: Record<string, string | undefined> = process.env,
): HttpSearchClient | null {
  const preset = env.SIGNAL_SEARCH_PROVIDER;
  const apiKey = env.SIGNAL_SEARCH_API_KEY;

  if (!preset || !apiKey) return null;

  const base = SEARCH_PRESETS[preset];
  if (!base) {
    throw new Error(
      `unknown search provider "${preset}"; expected one of ${Object.keys(SEARCH_PRESETS).join(', ')}`,
    );
  }

  return new HttpSearchClient({ ...base, apiKey });
}
