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
import type { ScoreJudgements } from '../scoring.ts';
import type { FreshnessResult } from '../freshness.ts';

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

export interface ExtractionOutput {
  /** Signal type, e.g. "export_finance". Extensible — no enum. */
  trigger: string;
  whatChanged: string;
  facts: Fact[];
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
  /** Researcher judgements; evidence quality is derived, so it is excluded. */
  judgements: Omit<ScoreJudgements, 'evidenceQuality'>;
  whyNow: string;
  salesAngle: string;
}

export type RejectionStage =
  | 'identity'
  | 'icp'
  | 'no_trigger_found'
  | 'stale'
  | 'contradiction'
  | 'invalid_chain';

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
  /** Present when the chain was built but failed validation. */
  errors?: string[];
}

export type ResearchOutcome =
  | { outcome: 'signal'; signal: ResearchSignal; candidate: Candidate }
  | { outcome: 'no_signal'; rejection: NoSignal };
