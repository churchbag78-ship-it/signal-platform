/**
 * Extracted claims, and their promotion to Facts.
 *
 * The division of labour is the point of this module:
 *
 *   The MODEL extracts attributes. It reports what a source says, what company
 *   the source appears to be about, and which attributes it read that from.
 *
 *   The ENGINE decides. It classifies the source, runs the identity gate on
 *   the attributes provided, and only then promotes a claim to a Fact.
 *
 * An extractor is therefore not permitted to assert "this source is about the
 * target". It has no field in which to say so. It supplies `statedName`,
 * `statedGeography`, `statedIndustry`, `statedDomain`, `statedCompanyNumber` —
 * and `attributeSource()` reaches the verdict.
 *
 * Two impossibilities are enforced here rather than documented:
 *   - a Fact without a valid source cannot be constructed
 *   - a claim asserting attribution without attributes cannot be promoted
 */

import type {
  Fact,
  IdentityFingerprint,
  IdentityVerdict,
  IsoDate,
  SourceAttribution,
  Verification,
} from '../domain.ts';
import { attributeSource, ownedDomains } from '../identity.ts';
import { classifySource, type ClaimTopic } from './sources.ts';

/**
 * One claim as read out of one source. This is the extractor's output unit —
 * structured evidence, never prose, and never a Fact.
 */
export interface ExtractedClaim {
  id: string;
  /** What the source states, quoted or closely paraphrased. */
  claimText: string;
  /** The passage the claim was read from. Required: it is the audit trail. */
  supportingPassage: string;
  sourceUrl: string;
  /** What the extractor believes the source is — checked against the registry. */
  statedSourceType?: string;
  /** When the source was published, where the source says. */
  publicationDate?: IsoDate;
  /** When the thing described happened. Never substituted by publication date. */
  eventDate?: IsoDate;
  /** What the claim is about, so the source can be scored in context. */
  topic: ClaimTopic;
  /** Identity attributes READ FROM THE SOURCE — never copied from the target. */
  identityAttributes: {
    statedName?: string;
    statedDomain?: string;
    statedGeography?: { country?: string; region?: string; town?: string };
    statedIndustry?: string;
    statedDescriptors?: string[];
    statedCompanyNumber?: string;
  };
  /** The extractor's own confidence that it read the source correctly, 0-1. */
  extractionConfidence: number;
  /** Syndication group: copies of one release share this and count as one. */
  originId?: string;
  /** Whether the page itself was opened, or only a search summary read. */
  verification: Verification;
}

export interface ClaimValidation {
  valid: boolean;
  errors: string[];
}

/** Schema-level checks. Nothing here consults the target. */
export function validateExtractedClaim(claim: ExtractedClaim): ClaimValidation {
  const errors: string[] = [];

  if (!claim.id?.trim()) errors.push('claim has no id');
  if (!claim.claimText?.trim()) errors.push(`claim "${claim.id}" has no claim text`);
  if (!claim.supportingPassage?.trim()) {
    errors.push(`claim "${claim.id}" has no supporting passage — the claim is unevidenced`);
  }

  // A Fact without a valid source must be impossible.
  if (!claim.sourceUrl?.trim()) {
    errors.push(`claim "${claim.id}" has no source URL`);
  } else {
    try {
      const parsed = new URL(claim.sourceUrl);
      if (!/^https?:$/.test(parsed.protocol)) {
        errors.push(`claim "${claim.id}" has a non-http source URL`);
      }
    } catch {
      errors.push(`claim "${claim.id}" has an unparseable source URL`);
    }
  }

  const attributes = claim.identityAttributes ?? {};
  const provided = Object.values(attributes).filter(
    (value) => value !== undefined && value !== null && String(value).length > 0,
  );
  if (provided.length === 0) {
    // The rule that stops "trust me, it's them".
    errors.push(
      `claim "${claim.id}" supplies no identity attributes — attribution cannot be justified`,
    );
  }

  for (const [field, value] of [
    ['publicationDate', claim.publicationDate],
    ['eventDate', claim.eventDate],
  ] as const) {
    if (value !== undefined && Number.isNaN(Date.parse(value))) {
      errors.push(`claim "${claim.id}" has an unparseable ${field}`);
    }
  }

  if (
    typeof claim.extractionConfidence !== 'number' ||
    claim.extractionConfidence < 0 ||
    claim.extractionConfidence > 1
  ) {
    errors.push(`claim "${claim.id}" has an out-of-range extraction confidence`);
  }

  return { valid: errors.length === 0, errors };
}

export function toAttribution(claim: ExtractedClaim): SourceAttribution {
  return { url: claim.sourceUrl, ...claim.identityAttributes };
}

export type PromotionOutcome =
  | { status: 'promoted'; fact: Fact; verdict: IdentityVerdict }
  | { status: 'invalid'; errors: string[] }
  | { status: 'rejected'; verdict: IdentityVerdict };

/**
 * The only route from an extracted claim to a Fact. Validates the schema,
 * classifies the source in the context of the claim's topic, then puts the
 * extractor's attributes through the identity gate.
 */
export function promoteToFact(
  claim: ExtractedClaim,
  fingerprint: IdentityFingerprint,
  discoveredAt: IsoDate,
): PromotionOutcome {
  const validation = validateExtractedClaim(claim);
  if (!validation.valid) {
    return { status: 'invalid', errors: validation.errors };
  }

  const attribution = toAttribution(claim);
  const verdict = attributeSource(fingerprint, attribution);
  if (verdict.status !== 'match') {
    return { status: 'rejected', verdict };
  }

  const classification = classifySource(claim.sourceUrl, {
    ownedDomains: ownedDomains(fingerprint),
    topic: claim.topic,
  });

  const fact: Fact = {
    kind: 'fact',
    id: claim.id,
    statement: claim.claimText,
    source: {
      url: claim.sourceUrl,
      tier: classification.tier,
      publisher: classification.publisher,
      ...(claim.originId ? { originId: claim.originId } : {}),
    },
    ...(claim.eventDate ? { eventDate: claim.eventDate } : {}),
    discoveredAt,
    verification: claim.verification,
    attribution,
    identity: verdict,
  };

  return { status: 'promoted', fact, verdict };
}

// --- polarity validation ---------------------------------------------------

export type SignalPolarity = 'demand_increasing' | 'demand_reducing' | 'neutral';

const CONTRACTION_MARKERS = [
  'redundanc', 'job loss', 'jobs loss', 'lay off', 'layoff', 'closure', 'closing',
  'shut down', 'shutdown', 'administration', 'liquidation', 'insolven',
  'downsiz', 'withdraw', 'exiting', 'scaling back', 'slowing', 'decline',
  'cut ', 'cuts', 'consultation on', 'restructur', 'loss-making',
];

const EXPANSION_MARKERS = [
  'expansion', 'expanding', 'new facility', 'new premises', 'investment',
  'funding', 'growth', 'hiring', 'recruiting', 'new contract', 'contract win',
  'acquisition', 'acquired', 'opened', 'opening', 'launch',
];

export interface PolarityCheck {
  consistent: boolean;
  warnings: string[];
}

/**
 * Polarity is an extracted JUDGEMENT, not evidence, so it is checked against
 * the claim text rather than trusted. Contraction language declared as
 * demand-increasing is the case that matters: it is how a redundancy
 * announcement gets sold as a growth signal.
 *
 * A demand-increasing reading of contraction evidence is not forbidden — a
 * cost-reduction vendor may genuinely benefit — but it must carry its own
 * commercial rationale rather than passing silently.
 */
export function validatePolarity(
  claims: ExtractedClaim[],
  polarity: SignalPolarity,
  polarityRationale: string,
): PolarityCheck {
  const warnings: string[] = [];
  const corpus = claims.map((c) => `${c.claimText} ${c.supportingPassage}`).join(' ').toLowerCase();

  const contraction = CONTRACTION_MARKERS.filter((marker) => corpus.includes(marker));
  const expansion = EXPANSION_MARKERS.filter((marker) => corpus.includes(marker));

  if (!polarityRationale?.trim()) {
    warnings.push('polarity was declared with no rationale');
  }

  if (contraction.length > 0 && polarity === 'demand_increasing') {
    const rationale = polarityRationale.toLowerCase();
    const explains = contraction.some((marker) => rationale.includes(marker.trim())) ||
      /despite|even though|because the client|cost|reduction|restructur/.test(rationale);

    if (!explains) {
      warnings.push(
        `evidence contains contraction language (${contraction.slice(0, 3).join(', ')}) ` +
          'but polarity is demand_increasing without a rationale that addresses it',
      );
    }
  }

  if (expansion.length > 0 && contraction.length === 0 && polarity === 'demand_reducing') {
    warnings.push(
      `evidence reads as expansion (${expansion.slice(0, 3).join(', ')}) but polarity is demand_reducing`,
    );
  }

  return { consistent: warnings.length === 0, warnings };
}
