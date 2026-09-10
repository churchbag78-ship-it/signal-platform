/**
 * PARTIAL PAGE RECONSTRUCTIONS — not retrieved pages.
 *
 * Read this before using them for anything.
 *
 * Page retrieval is blocked in this environment (the egress gateway returns
 * 403 to CONNECT for every host, from both the Node process and the agent's
 * fetch tool). These objects are built by wrapping the REAL search snippets —
 * which are the search engine's own extracts of those pages — in a minimal
 * body, so the verification path can be exercised end to end.
 *
 * What this validates: the mechanism. Retrieval, text extraction, passage
 * matching, level assignment, and the score movement that follows.
 *
 * What this does NOT validate: whether the claims are true against the real
 * pages. Each claim's passage came from the same snippet these bodies are
 * built from, so a passage match here is close to circular. Real verification
 * requires real retrieval and remains unvalidated.
 */

import { contentHash, type RetrievedPage } from '../src/research/retrieval.ts';
import type { CaptureFile } from '../src/research/agent-bridge.ts';
import { liveCaptureV3 } from './pilot-a-live-v3.ts';
import { liveCaptureV5 } from './pilot-a-live-v5.ts';

const RUN_DATE = '2026-09-09';

const BANNER =
  'RECONSTRUCTED FROM SEARCH SNIPPET — NOT A RETRIEVED PAGE. ' +
  'Body text below is the search engine\'s extract of this URL, not its full content.';

function reconstruct(url: string, title: string, snippet: string): RetrievedPage {
  const text = `${title}. ${snippet} ${BANNER}`;
  return {
    url,
    status: 200,
    contentType: 'text/html',
    text,
    retrievedAt: RUN_DATE,
    contentHash: contentHash(text),
  };
}

/** One reconstruction per captured search result, for any capture file. */
export function reconstructFrom(capture: CaptureFile): RetrievedPage[] {
  const byUrl = new Map<string, RetrievedPage>();
  for (const entry of capture.captures) {
    for (const result of entry.results) {
      // A URL found by several queries reconstructs once; the first snippet
      // wins, so the set does not depend on query order.
      if (!byUrl.has(result.url)) {
        byUrl.set(result.url, reconstruct(result.url, result.title, result.snippet));
      }
    }
  }
  return [...byUrl.values()];
}

/** One reconstruction per captured search result. */
export const reconstructedPages: RetrievedPage[] = liveCaptureV3.captures.flatMap((capture) =>
  capture.results.map((result) => reconstruct(result.url, result.title, result.snippet)),
);

/** The v5 corpus — first-party sweep plus change-family queries. */
export const reconstructedPagesV5: RetrievedPage[] = reconstructFrom(liveCaptureV5);

/** URLs cited by claims that have no reconstruction — retrieval would fail. */
export const reconstructedUrls = new Set(reconstructedPages.map((p) => p.url));
