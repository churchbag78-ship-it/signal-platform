/**
 * Replayable research.
 *
 * A run built from a captured corpus is deterministic, which means the whole
 * chain — extraction, validation, scoring, rejection — can be tested and
 * re-tested without touching the network or spending anything. When a live
 * search backend and a model extractor are added, they implement the same two
 * interfaces and everything downstream is unchanged.
 */

import type { CompanyIdentity } from '../domain.ts';
import { normalizeDomain } from '../domain.ts';
import type {
  ClaimExtractor,
  ExtractionOutput,
  ExtractionRequest,
  SearchClient,
  SearchResult,
} from './types.ts';

/** Search results captured from a real run, keyed by query. */
export class StaticSearchClient implements SearchClient {
  readonly id = 'static-corpus';
  readonly queriesSeen: string[] = [];
  readonly #corpus: SearchResult[];

  constructor(corpus: SearchResult[]) {
    this.#corpus = corpus;
  }

  async search(query: string): Promise<SearchResult[]> {
    this.queriesSeen.push(query);

    // Corpus entries are matched on the query they were captured for, falling
    // back to token overlap so a slightly reworded query still resolves.
    const exact = this.#corpus.filter((r) => r.query === query);
    if (exact.length > 0) return exact;

    const tokens = new Set(
      query
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 3),
    );

    return this.#corpus.filter((entry) => {
      const haystack = `${entry.query} ${entry.title}`.toLowerCase();
      let hits = 0;
      for (const token of tokens) {
        if (haystack.includes(token)) hits += 1;
      }
      return hits >= 2;
    });
  }
}

export type ExtractionCorpus = Record<string, ExtractionOutput | null>;

/**
 * Replays extraction decisions made by a researcher (a model or a person)
 * against captured results. Keyed by normalised domain; a domain mapped to
 * null is an explicit "researched, nothing found", which is different from a
 * domain that is absent.
 */
export class CorpusClaimExtractor implements ClaimExtractor {
  readonly id = 'corpus-extractor';

  readonly #corpus: ExtractionCorpus;

  constructor(corpus: ExtractionCorpus) {
    this.#corpus = corpus;
  }

  async extract(request: ExtractionRequest): Promise<ExtractionOutput | null> {
    const key = normalizeDomain(request.company.domain);

    if (!(key in this.#corpus)) {
      // Absent is not the same as "nothing found" — say so rather than
      // silently reporting a clean negative we never actually researched.
      throw new Error(
        `no extraction captured for ${key}; add it to the corpus or map it to null`,
      );
    }

    return this.#corpus[key] ?? null;
  }
}

export function targetsFromCorpus(
  entries: { name: string; domain: string; location?: string; industry?: string }[],
): CompanyIdentity[] {
  return entries.map((e) => ({
    name: e.name,
    domain: normalizeDomain(e.domain),
    ...(e.location ? { location: e.location } : {}),
    ...(e.industry ? { industry: e.industry } : {}),
  }));
}
