/**
 * Core domain types for the Signal intelligence engine.
 *
 * This module is deliberately free of any provider, database, transport or UI
 * concern. The engine must stay portable: it is the commercial reasoning
 * layer, and it should be possible to run it from a script, a worker or an
 * application without change.
 */

/** ISO-8601 date, e.g. "2026-08-15". */
export type IsoDate = string;

/**
 * Source credibility tiers, per docs/RESEARCH_METHODOLOGY.md §4.
 * 1 first-party · 2 public record · 3 established trade/news ·
 * 4 aggregator/directory · 5 social/unattributed.
 */
export type SourceTier = 1 | 2 | 3 | 4 | 5;

/**
 * How the evidence behind a claim was obtained.
 *
 * These are NOT interchangeable. A search snippet is a third party's summary of
 * a page; a retrieved page is the page. The engine must never score one as the
 * other, which is why the distinction is a type rather than a boolean.
 *
 *  - `page_retrieved` — the page was fetched and the supporting passage was
 *    found in its body.
 *  - `search_snippet` — only a search-engine summary was read.
 */
export type Verification = 'page_retrieved' | 'search_snippet';

export type Confidence = 'High' | 'Medium' | 'Low';

export type DecisionState =
  | 'CONFIRMED_OPPORTUNITY'
  | 'PROBABLE_OPPORTUNITY'
  | 'HYPOTHESIS'
  | 'INSUFFICIENT_EVIDENCE';

export interface Source {
  url: string;
  tier: SourceTier;
  publisher: string;
  /**
   * Syndication group. Copies of one press release share an originId and count
   * as ONE independent source. Omitted means "independent of everything else".
   */
  originId?: string;
}

export interface Evidence {
  /** What the source actually claims, quoted or closely paraphrased. */
  claim: string;
  source: Source;
  /** Date of the event or announcement — never the crawl date. */
  signalDate?: IsoDate;
  retrievedAt: IsoDate;
  verification: Verification;
}

export interface CompanyIdentity {
  name: string;
  /** Identity key. Never match companies on name alone. */
  domain: string;
  location?: string;
  industry?: string;
}

/** How an alias domain came to be trusted. Provenance is never discarded. */
export type AliasVerification = 'human' | 'first_party_link' | 'public_record' | 'unverified';

export interface AliasDomain {
  domain: string;
  /** What establishes that this domain is the same company. */
  evidence: string;
  sourceUrl?: string;
  verifiedAt?: IsoDate;
  verifiedBy: AliasVerification;
}

export interface Geography {
  country?: string;
  region?: string;
  town?: string;
}

/**
 * Everything known that distinguishes this company from a same-named one.
 * Identity is an invariant of the pipeline, not a search-query optimisation:
 * no claim enters the evidence corpus until it is attributed to a fingerprint.
 */
export interface IdentityFingerprint {
  canonicalName: string;
  canonicalDomain: string;
  aliasDomains?: AliasDomain[];
  /** Trading names, brands and former names. */
  tradingNames?: string[];
  geography?: Geography;
  industry?: string;
  /** Distinguishing words: "gear pumps", "technical textiles", "fine food". */
  descriptors?: string[];
  /** Companies House number or equivalent registry identifier. */
  companyNumber?: string;
  /** Declared subsidiaries — a source about one attributes to this identity. */
  subsidiaries?: string[];
  /** Declared parent. A source about the parent does NOT attribute here. */
  parent?: string;
}

/** What a source appears to be about, read from its title, snippet and URL. */
export interface SourceAttribution {
  url: string;
  statedName?: string;
  statedDomain?: string;
  statedGeography?: Geography;
  statedIndustry?: string;
  statedDescriptors?: string[];
  statedCompanyNumber?: string;
}

export type IdentityStatus = 'match' | 'identity_collision' | 'unresolved';

export interface IdentityVerdict {
  status: IdentityStatus;
  /** 0-1. Confidence in the attribution, not in the claim itself. */
  confidence: number;
  corroborations: string[];
  conflicts: string[];
  explanation: string;
}

/** Derives the pipeline's lightweight identity from a full fingerprint. */
export function toCompanyIdentity(fingerprint: IdentityFingerprint): CompanyIdentity {
  return {
    name: fingerprint.canonicalName,
    domain: normalizeDomain(fingerprint.canonicalDomain),
    ...(fingerprint.geography?.town ? { location: fingerprint.geography.town } : {}),
    ...(fingerprint.industry ? { industry: fingerprint.industry } : {}),
  };
}

export interface Signal {
  /** Extensible by design — new signal types must not require engine changes. */
  type: string;
  description: string;
  evidence: Evidence[];
  /**
   * True when the situation is ongoing rather than a point event (a facility
   * still under construction), which exempts it from the 12-month cutoff.
   */
  structural?: boolean;
}

/**
 * The epistemic spine of the product.
 *
 * A FACT is something a source states, and carries that source.
 * An INFERENCE is something we concluded, and carries what it was concluded
 * from.
 * A HYPOTHESIS is a commercial implication — the reason to sell — and is
 * always labelled as unproven, with a stated way to test it.
 *
 * Keeping these separate is what stops "they announced a new facility" and
 * "they need a freight forwarder" from being presented with the same
 * authority. Collapsing them is the failure mode that makes a lead list look
 * like intelligence when it isn't.
 */
export interface Fact {
  kind: 'fact';
  id: string;
  /** What the source states, quoted or closely paraphrased. */
  statement: string;
  source: Source;
  /** When the thing happened. */
  eventDate?: IsoDate;
  /** When we found out about it. Never a substitute for eventDate. */
  discoveredAt: IsoDate;
  verification: Verification;
  /** What the source appears to be about — the input to identity checking. */
  attribution?: SourceAttribution;
  /** Whether this source was confirmed to speak for the target company. */
  identity?: IdentityVerdict;
}

export interface Inference {
  kind: 'inference';
  id: string;
  statement: string;
  /** Ids of the claims this was concluded from. Never empty. */
  derivedFrom: string[];
  reasoning: string;
}

export interface Hypothesis {
  kind: 'hypothesis';
  id: string;
  /** The commercial implication for the client. */
  statement: string;
  derivedFrom: string[];
  reasoning: string;
  /** What would confirm or kill this. A hypothesis you cannot test is an opinion. */
  testableBy: string;
}

export type Claim = Fact | Inference | Hypothesis;

export type ContradictionSeverity = 'caveat' | 'conflicting' | 'fatal';

export interface Contradiction {
  severity: ContradictionSeverity;
  note: string;
}

/**
 * The function that owns the problem the signal creates — reasoning output,
 * not contact data. Available with no provider at all.
 */
export interface DecisionMakerRole {
  /** e.g. "Operations", "Supply Chain", "Procurement". Not a person. */
  function: string;
  rationale: string;
}

/** Result of optional, downstream person-level enrichment. */
export type ContactStatus = 'found' | 'not_available' | 'not_attempted';

export interface ContactResult {
  status: ContactStatus;
  name?: string;
  title?: string;
  source?: Source;
}

/**
 * Whether a change increases or decreases demand for THIS client's offer.
 *
 * Defined here rather than in the research layer because scoring needs it: the
 * direction of a change is a commercial fact about the change, not a detail of
 * how it was extracted.
 */
export type SignalPolarity = 'demand_increasing' | 'demand_reducing' | 'neutral';

export interface Candidate {
  company: CompanyIdentity;
  signal: Signal;
  icpFitNotes: string;
  contradictions: Contradiction[];
  /**
   * Steps of inference between the signal and the client's offer. 1 means the
   * signal directly implies the need; each step beyond that is penalised.
   */
  inferenceSteps: number;
  decisionMakerRole?: DecisionMakerRole;
  contact?: ContactResult;
  /** The fact → inference → hypothesis chain behind this candidate. */
  claims?: Claim[];
  /**
   * Direction of the change for this client. Absent means the research layer
   * did not establish one, which scores as `neutral` rather than as growth.
   */
  polarity?: SignalPolarity;
  /**
   * True when the research layer judged the change to create something this
   * client can act on. Absent is treated as false.
   */
  consequenceActionable?: boolean;
}

/** Normalises a domain so it can be used as the identity key. */
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
}

/** Whole days between two ISO dates. Negative when `to` precedes `from`. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const ms = Date.parse(to) - Date.parse(from);
  return Math.floor(ms / 86_400_000);
}
