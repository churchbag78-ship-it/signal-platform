/**
 * Container adapter for the v1/v2 fixtures.
 *
 * Those captures predate the ClaimExtractor contract, in which extractors
 * emit structured claims and only the engine may build a Fact. Their DATA is
 * unchanged and still historical evidence — this only re-shapes the container
 * so they continue to exercise the current pipeline.
 *
 * New captures should be written natively as ExtractedClaims.
 */

import type { Fact, SourceAttribution } from '../src/domain.ts';
import type { ExtractedClaim } from '../src/research/extraction.ts';
import type { ClaimTopic } from '../src/research/registry.ts';

/** Maps a legacy Fact plus its attribution into an extracted claim. */
export function asClaims(
  facts: Fact[],
  stated: Omit<SourceAttribution, 'url'>,
  topic: ClaimTopic = 'general',
): ExtractedClaim[] {
  return facts.map((fact) => {
    // A fact that carries its own attribution keeps it. Flattening one
    // attribution across a whole array would silently hand a colliding
    // source the target's identity — which is the failure the gate exists
    // to catch.
    const { url: _ignored, ...own } = fact.attribution ?? { url: '' };
    const attributes = fact.attribution ? own : stated;
    return {
      id: fact.id,
      claimText: fact.statement,
      // These captures recorded the claim and the passage as one string.
      supportingPassage: fact.statement,
      sourceUrl: fact.source.url,
      ...(fact.eventDate ? { eventDate: fact.eventDate } : {}),
      topic,
      identityAttributes: { ...attributes },
      extractionConfidence: 0.8,
      ...(fact.source.originId ? { originId: fact.source.originId } : {}),
      verification: fact.verification,
    };
  });
}
