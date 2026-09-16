/**
 * Stages 4 and 5: searches become candidate companies.
 *
 * This is the half of the product that never existed. Everything the engine
 * already does starts from a company somebody named; this module is where a
 * company arrives from the outside, which means two jobs nothing else does.
 *
 * WHICH COMPANY IS THIS ABOUT. A result about a contract award names the
 * awarding body, the winner, the consultant and the local council. Only one of
 * them had the event. Getting this wrong does not produce a weak opportunity,
 * it produces a confident opportunity about the wrong company — so the model is
 * asked for the subject and the role, and anything it cannot place is dropped.
 *
 * DID ANYTHING ACTUALLY HAPPEN. Search returns listicles, directory pages,
 * "top 10 suppliers" articles and vendor marketing. None of them are events.
 * A candidate with no dated, attributable change is not a thin lead; it is not
 * a lead.
 *
 * What this module deliberately does NOT do is decide whether a candidate is an
 * opportunity. It only says "here is a company, and here is what appears to
 * have happened to it". The existing engine makes every judgement after that.
 */

import { parseJsonObject } from '../../engine/src/research/llm-extractor.ts';
import type { IsoDate } from '../../engine/src/domain.ts';
import type { SearchResult } from '../../engine/src/research/types.ts';
import type { CommercialModel } from './commercial-model.ts';
import type { DemandTrigger } from './triggers.ts';
import type { ModelClient } from './transport.ts';

export const CANDIDATE_PROMPT = `You read search results and identify companies that something has HAPPENED to.

You are given a demand trigger — a kind of business change — and search results
found while looking for it. Your job is to say which companies these results are
about, and what appears to have happened to each.

The hard part is the subject. A single article can mention the company the event
happened to, the supplier who did the work, the consultant who advised, the
council that approved it, and three companies quoted for comparison. Only the
FIRST of those is a candidate. If you cannot tell which company the event
happened to, say so and move on — a confident guess about the wrong company is
the worst output you can produce.

Do not return:
- listicles, directories, "top 10" articles, supplier lists
- pages about the search terms rather than about a company
- vendor marketing describing what they sell
- a company with no discrete change: "is a leading provider" is not an event
- an event with no date and no recency language at all

Do not infer a domain you have not seen. If the result does not show the
company's website, leave domain empty — a guessed domain becomes a wrong
identity downstream.

Return a single JSON object and nothing else:

{
  "candidates": [
    {
      "companyName": "the company the event happened to, as written",
      "domain": "their website domain if it appears in the results, else \\"\\"",
      "whatHappened": "the change, in one sentence, using only what the results say",
      "whenText": "the date or time expression the results give, else \\"\\"",
      "location": "town/region/country if stated, else \\"\\"",
      "industryHint": "what kind of business they are, if the results say",
      "sourceUrls": ["the result URLs this came from"],
      "role": "subject",
      "confidence": 0.0
    }
  ],
  "ignored": [
    { "url": "result URL", "why": "why this result contained no candidate" }
  ]
}

"role" must be "subject" — only return companies the event happened TO. Set
confidence to how sure you are that you have the right company and a real event.
Populate "ignored" for every result you discarded; a run that cannot say what it
threw away cannot be audited.`;

export interface CandidateMention {
  companyName: string;
  domain: string;
  whatHappened: string;
  whenText: string;
  location: string;
  industryHint: string;
  sourceUrls: string[];
  confidence: number;
  /** Which demand trigger the search that found it was testing. */
  triggerId: string;
}

export interface DiscoveryResult {
  candidates: CandidateMention[];
  ignored: { url: string; why: string }[];
  /** Results the model was shown, for coverage reporting. */
  resultsSeen: number;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

const MIN_CONFIDENCE = 0.4;

export function coerceCandidates(raw: unknown, triggerId: string, resultsSeen: number): DiscoveryResult {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('the candidate response was not a JSON object');
  }
  const o = raw as Record<string, unknown>;

  const candidates: CandidateMention[] = [];
  const ignored = (Array.isArray(o.ignored) ? o.ignored : [])
    .map((entry) => {
      const e = (entry ?? {}) as Record<string, unknown>;
      return { url: text(e.url), why: text(e.why) };
    })
    .filter((entry) => entry.url.length > 0);

  for (const entry of Array.isArray(o.candidates) ? o.candidates : []) {
    const e = (entry ?? {}) as Record<string, unknown>;
    const companyName = text(e.companyName);
    const whatHappened = text(e.whatHappened);
    const sourceUrls = (Array.isArray(e.sourceUrls) ? e.sourceUrls : [])
      .map((url) => text(url))
      .filter((url) => url.startsWith('http'));

    const confidenceRaw = typeof e.confidence === 'number' ? e.confidence : Number(e.confidence);
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0;

    if (!companyName || !whatHappened || sourceUrls.length === 0) {
      ignored.push({
        url: sourceUrls[0] ?? '(none)',
        why: 'candidate had no company, no change, or no source',
      });
      continue;
    }
    if (text(e.role, 'subject') !== 'subject') {
      ignored.push({ url: sourceUrls[0]!, why: `${companyName} is not the subject of the event` });
      continue;
    }
    if (confidence < MIN_CONFIDENCE) {
      ignored.push({
        url: sourceUrls[0]!,
        why: `too unsure which company ${companyName} refers to (${confidence.toFixed(2)})`,
      });
      continue;
    }

    candidates.push({
      companyName,
      domain: text(e.domain).replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase(),
      whatHappened,
      whenText: text(e.whenText),
      location: text(e.location),
      industryHint: text(e.industryHint),
      sourceUrls,
      confidence,
      triggerId,
    });
  }

  return { candidates, ignored, resultsSeen };
}

function renderResults(results: SearchResult[]): string {
  return results
    .map(
      (result, index) =>
        `[${index + 1}] ${result.title}\n    url: ${result.url}\n    ${result.snippet}`,
    )
    .join('\n\n');
}

export async function extractCandidates(
  results: SearchResult[],
  trigger: DemandTrigger,
  model: CommercialModel,
  client: ModelClient,
  runDate: IsoDate,
): Promise<DiscoveryResult> {
  if (results.length === 0) {
    return { candidates: [], ignored: [], resultsSeen: 0 };
  }

  const response = await client.complete({
    purpose: 'candidate-extraction',
    system: CANDIDATE_PROMPT,
    user: [
      `Today is ${runDate}.`,
      '',
      `DEMAND TRIGGER being tested: ${trigger.event}`,
      `Why it matters to the client: ${trigger.mechanism}`,
      `Client geography: ${model.geography}`,
      '',
      'SEARCH RESULTS:',
      renderResults(results),
    ].join('\n'),
    maxTokens: 4096,
  });

  return coerceCandidates(parseJsonObject(response), trigger.id, results.length);
}

/**
 * Merge candidates found by different triggers.
 *
 * A company that shows up under two different demand triggers is a stronger
 * lead, not a duplicate, so the triggers are accumulated rather than the second
 * sighting discarded.
 */
export function mergeCandidates(groups: CandidateMention[][]): (CandidateMention & { triggerIds: string[] })[] {
  const byKey = new Map<string, CandidateMention & { triggerIds: string[] }>();

  for (const group of groups) {
    for (const candidate of group) {
      const key = candidate.domain || candidate.companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { ...candidate, triggerIds: [candidate.triggerId] });
        continue;
      }
      if (!existing.triggerIds.includes(candidate.triggerId)) {
        existing.triggerIds.push(candidate.triggerId);
      }
      for (const url of candidate.sourceUrls) {
        if (!existing.sourceUrls.includes(url)) existing.sourceUrls.push(url);
      }
      if (!existing.domain && candidate.domain) existing.domain = candidate.domain;
      if (candidate.confidence > existing.confidence) existing.confidence = candidate.confidence;
    }
  }

  return [...byKey.values()];
}
