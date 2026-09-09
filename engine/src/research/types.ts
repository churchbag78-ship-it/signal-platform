/**
 * The research layer's contracts.
 *
 * Search execution and claim extraction are interfaces because they need the
 * world — a search API and a model or a human. Everything the engine does with
 * their output is deterministic, so a run can be replayed and audited.
 */

import type {
  Candidate,
  Claim,
  CompanyIdentity,
  Contradiction,
  DecisionMakerRole,
  Fact,
  Hypothesis,
  Inference,
  IsoDate,
} from '../domain.ts';
import type { ClientProfile } from '../pipeline.ts';
import type { ExtractedClaim, SignalPolarity } from './extraction.ts';
import type { VerificationResult } from './retrieval.ts';
import type { ScoreJudgements } from '../scoring.ts';
import type { FreshnessResult } from '../freshness.ts';
import type { ResearchCoverage } from './history.ts';
import type { DirectionAssessment } from '../direction.ts';

export type { SignalPolarity };

export interface SearchResult {
  query: string;
  title: string;
  url: string;
  snippet: string;
  retrievedAt: IsoDate;
}

/** A search backend. Web search, a news API, a filings feed — all fit here. */
export interface SearchClient {
  readonly id: string;
  search(query: string): Promise<SearchResult[]>;
}

/**
 * Turns search results into a claim chain. This is the judgement step: what
 * the source means, and whether it implies demand for this client. A model or
 * a human implements it; the engine never guesses on its behalf.
 *
 * Returning null means "researched, nothing found" — which is a real result,
 * not a failure, and must be distinguishable from "not researched".
 */
export interface ClaimExtractor {
  readonly id: string;
  extract(request: ExtractionRequest): Promise<ExtractionOutput | null>;
}

export interface ExtractionRequest {
  company: CompanyIdentity;
  client: ClientProfile;
  results: SearchResult[];
  runDate: IsoDate;
}

/**
 * Whether the change increases or decreases demand for THIS client's offer.
 * Signal is not restricted to growth: contraction, consolidation, closure,
 * relocation, divestment and regulatory change are all valid triggers. The
 * question is never "is this company growing?" but "does this change create a
 * commercially actionable consequence for this client?".
 */
export interface CommercialConsequence {
  actionable: boolean;
  rationale: string;
}

export interface ExtractionOutput {
  /** Signal type, e.g. "export_finance". Extensible — no enum. */
  trigger: string;
  whatChanged: string;
  polarity: SignalPolarity;
  /**
   * Why that polarity — an extracted judgement, kept separate from the
   * evidence and validated against it rather than trusted.
   */
  polarityRationale: string;
  /** Does this change create something the client can act on commercially? */
  consequence: CommercialConsequence;
  /**
   * Structured claims, NOT Facts. The engine classifies each source, runs the
   * identity gate, and only then promotes a claim to a Fact.
   */
  claims: ExtractedClaim[];
  inferences: Inference[];
  hypothesis: Hypothesis;
  owningFunction: DecisionMakerRole;
  icpRelevance: IcpRelevance;
  contradictions: Contradiction[];
  judgements: Omit<ScoreJudgements, 'evidenceQuality'> & { evidenceQuality?: number };
  whyNow: string;
  salesAngle: string;
}

export interface IcpRelevance {
  fits: boolean;
  rationale: string;
}

/** A researched company that produced a signal. */
export interface ResearchSignal {
  company: CompanyIdentity;
  trigger: string;
  whatChanged: string;
  eventDate?: IsoDate;
  discoveredAt: IsoDate;
  /**
   * The direction the EVIDENCE supports, derived by the engine from per-claim
   * demand impacts. This is what scoring reads.
   */
  polarity: SignalPolarity;
  /** What the extractor declared, kept for comparison. */
  declaredPolarity: SignalPolarity;
  /** How the grounded direction was reached, and what was ignored. */
  direction: DirectionAssessment;
  polarityRationale: string;
  /** Warnings where the declared polarity disagrees with the evidence. */
  polarityWarnings: string[];
  /** Per-source verification outcomes: what each claim's evidence earned. */
  verifications: VerificationResult[];
  consequence: CommercialConsequence;
  /** Sources dropped before the corpus, on identity grounds. */
  identityRejections: { url: string; status: string; explanation: string }[];
  claims: Claim[];
  facts: Fact[];
  hypothesis: Hypothesis;
  freshness: FreshnessResult;
  icpRelevance: IcpRelevance;
  owningFunction: DecisionMakerRole;
  contradictions: Contradiction[];
  /** Reasoning hops from facts to hypothesis, measured from the chain. */
  inferenceDepth: number;
  queriesRun: string[];
  /** What the run managed to look at, independent of what it found. */
  coverage: ResearchCoverage;
  /** Researcher judgements; evidence quality is derived, so it is excluded. */
  judgements: Omit<ScoreJudgements, 'evidenceQuality'>;
  whyNow: string;
  salesAngle: string;
}

/**
 * These outcomes must never collapse into one another. "We looked and found
 * nothing", "we found something but it is too thin", "we could not tell whether
 * the sources were even about this company" and "the sources were about a
 * different company" are four different statements with four different
 * follow-up actions.
 */
export type RejectionStage =
  | 'identity'
  | 'identity_collision'
  | 'identity_unresolved'
  | 'icp'
  | 'no_trigger_found'
  | 'insufficient_evidence'
  | 'no_commercial_consequence'
  | 'stale'
  | 'contradiction'
  | 'invalid_chain'
  | 'invalid_claims'
  /**
   * The research could not be performed — no query in the plan could be
   * executed. This is NEVER a finding about the company, and must never be
   * read as one.
   */
  | 'research_failure';

/**
 * A researched company that produced nothing. Recording these is not
 * bookkeeping: "we looked and found nothing" is a different and more useful
 * statement than silence, and it stops the same dead end being re-researched
 * every run.
 */
export interface NoSignal {
  company: CompanyIdentity;
  stage: RejectionStage;
  reason: string;
  queriesRun: string[];
  /** What the run managed to look at. Absent for pre-search rejections. */
  coverage?: ResearchCoverage;
  /** Present when the chain was built but failed validation. */
  errors?: string[];
  /** Sources rejected on identity, with the verdict that rejected them. */
  identityRejections?: { url: string; status: string; explanation: string }[];
}

export type ResearchOutcome =
  | { outcome: 'signal'; signal: ResearchSignal; candidate: Candidate }
  | { outcome: 'no_signal'; rejection: NoSignal };
