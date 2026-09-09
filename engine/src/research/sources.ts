/**
 * Source classification — URL plus claim topic to tier.
 *
 * Classification is contextual: the same publisher can be strong evidence for
 * one kind of claim and weak for another. A job board proves a vacancy exists
 * and proves nothing about a contract award; a private equity house is primary
 * about its own portfolio and promotional about the market.
 *
 * An unrecognised host stays at tier 4 and flagged for review. In an evidence
 * product, over-trusting an unknown source is worse than under-scoring a good
 * one — an under-scored row is visible in the output, an over-trusted one is
 * not. Coverage improves by growing the registry, never by relaxing this.
 */

import type { Source, SourceTier } from '../domain.ts';
import { normalizeDomain } from '../domain.ts';
import { lookupRegistry, type ClaimTopic, type SourceCategory } from './registry.ts';

export type { ClaimTopic, SourceCategory };

export interface Classification {
  tier: SourceTier;
  category: SourceCategory;
  publisher: string;
  /** True when the host was not recognised and the tier is a safe default. */
  needsReview: boolean;
  /** True when the registry says this source is authoritative for this topic. */
  authoritativeForTopic: boolean;
  /** Human-readable audit trail for this classification. */
  rationale: string;
}

export interface ClassifyOptions {
  /** Domains the company owns — canonical plus VERIFIED aliases only. */
  ownedDomains?: string[];
  /** What the claim is about. Omitted means judge on general credibility. */
  topic?: ClaimTopic;
}

function hostOf(url: string): string {
  try {
    return normalizeDomain(new URL(url).hostname);
  } catch {
    return normalizeDomain(url);
  }
}

export function classifySource(url: string, options: ClassifyOptions = {}): Classification {
  const host = hostOf(url);

  if (!host) {
    return {
      tier: 5,
      category: 'unknown',
      publisher: 'unknown',
      needsReview: true,
      authoritativeForTopic: false,
      rationale: 'no resolvable host',
    };
  }

  for (const owned of options.ownedDomains ?? []) {
    const own = normalizeDomain(owned);
    if (own && (host === own || host.endsWith(`.${own}`))) {
      return {
        tier: 1,
        category: 'first_party',
        publisher: host,
        needsReview: false,
        authoritativeForTopic: true,
        rationale: `published on ${host}, a verified domain of the target company`,
      };
    }
  }

  const entry = lookupRegistry(host);
  if (!entry) {
    return {
      tier: 4,
      category: 'unknown',
      publisher: host,
      needsReview: true,
      authoritativeForTopic: false,
      rationale: `${host} is not in the source registry; treated conservatively pending review`,
    };
  }

  const topic = options.topic;
  const authoritative =
    topic === undefined
      ? entry.authoritativeFor.length > 0
      : entry.authoritativeFor.includes(topic) || entry.authoritativeFor.includes('general');

  const tier = authoritative ? entry.tier : entry.outOfScopeTier;

  const rationale = authoritative
    ? `${host} (${entry.category}, tier ${tier}) — ${entry.provenance.evidence}`
    : `${host} (${entry.category}) is tier ${entry.tier} for ${entry.authoritativeFor.join(', ') || 'general reporting'} ` +
      `but this claim is about ${topic ?? 'an unstated topic'}, so it is scored at tier ${tier}`;

  return {
    tier,
    category: entry.category,
    publisher: host,
    needsReview: false,
    authoritativeForTopic: authoritative,
    rationale,
  };
}

export function toSource(
  url: string,
  options: ClassifyOptions = {},
  originId?: string,
): Source {
  const classification = classifySource(url, options);
  return {
    url,
    tier: classification.tier,
    publisher: classification.publisher,
    ...(originId ? { originId } : {}),
  };
}
