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

/** Whether the source page was actually opened, or only summarised. */
export type Verification = 'sources_opened' | 'search_summary_only';

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
