/**
 * Evidence assessment — docs/RESEARCH_METHODOLOGY.md §4.
 *
 * The single rule that matters here: multiple copies of one press release are
 * ONE source. Syndication is the most common way a research run inflates its
 * own confidence, and it is invisible unless independence is modelled
 * explicitly.
 */

import type { Evidence, SourceTier, Verification } from './domain.ts';

export interface EvidenceAssessment {
  /** Best (lowest-numbered) tier present. 5 when there is no evidence at all. */
  bestTier: SourceTier;
  /** Distinct origins, not distinct articles. */
  independentSources: number;
  hasDate: boolean;
  /**
   * 'page_retrieved' only when at least one piece of evidence AT THE BEST TIER
   * was actually opened. Opening a weak secondary does not verify a claim that
   * rests on an unopened primary.
   */
  verification: Verification;
}

export function assessEvidence(evidence: Evidence[]): EvidenceAssessment {
  if (evidence.length === 0) {
    return {
      bestTier: 5,
      independentSources: 0,
      hasDate: false,
      verification: 'search_snippet',
    };
  }

  const bestTier = evidence.reduce<SourceTier>(
    (best, e) => (e.source.tier < best ? e.source.tier : best),
    5,
  );

  // originId groups syndicated copies. Without one, the URL is the origin.
  const origins = new Set(evidence.map((e) => e.source.originId ?? e.source.url));

  const hasDate = evidence.some(
    (e) => typeof e.signalDate === 'string' && !Number.isNaN(Date.parse(e.signalDate)),
  );

  const bestTierOpened = evidence.some(
    (e) => e.source.tier === bestTier && e.verification === 'page_retrieved',
  );

  return {
    bestTier,
    independentSources: origins.size,
    hasDate,
    verification: bestTierOpened ? 'page_retrieved' : 'search_snippet',
  };
}
