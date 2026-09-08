/**
 * The research loop: company/domain in, source-backed commercial signal out.
 *
 * The chain it produces is company → verified change → commercial implication
 * → client relevance → score → recommended action, and every link is either
 * sourced or explicitly labelled as reasoning.
 */

import type {
  Candidate,
  CompanyIdentity,
  Claim,
  IsoDate,
} from '../domain.ts';
import { normalizeDomain } from '../domain.ts';
import { factsToEvidence, supportingFacts, validateChain } from '../claims.ts';
import { assessFreshness } from '../freshness.ts';
import { assessEvidence } from '../evidence.ts';
import type { ClientProfile, ResearchAdapter } from '../pipeline.ts';
import type { ScoreJudgements } from '../scoring.ts';
import type {
  ClaimExtractor,
  ResearchOutcome,
  ResearchSignal,
  SearchClient,
} from './types.ts';

export interface WebResearchOptions {
  search: SearchClient;
  extractor: ClaimExtractor;
  /** Companies to research this run. */
  targets: CompanyIdentity[];
  runDate: IsoDate;
  /** Queries per company. Kept small — search is the expensive part. */
  maxQueriesPerCompany?: number;
}

/**
 * Query generation is driven by the CLIENT's demand triggers, not a generic
 * template. Two clients researching the same company should ask different
 * questions, because they are looking for different changes.
 */
export function buildQueries(
  company: CompanyIdentity,
  client: ClientProfile,
  limit = 4,
): string[] {
  const name = company.name;
  const queries = [
    // What changed, generally and recently.
    `${name} ${company.location ?? ''} news announcement expansion contract`.replace(/\s+/g, ' ').trim(),
    // Client-specific triggers: the signal model, not a generic list.
    ...client.demandTriggers.map((trigger) => `${name} ${trigger}`),
    // The contradiction pass has to be a query too, or it never happens.
    `${name} administration closure delayed cancelled loss`,
  ];

  return queries.slice(0, limit);
}

/** Evidence quality derived from what the sources actually are. */
export function deriveEvidenceQuality(claims: Claim[], hypothesisId: string): number {
  const facts = supportingFacts(hypothesisId, claims);
  if (facts.length === 0) return 0;

  const assessment = assessEvidence(factsToEvidence(facts));

  // Tier drives most of it; independence and verification adjust.
  const tierPoints = { 1: 11, 2: 10, 3: 7, 4: 3, 5: 1 }[assessment.bestTier] ?? 1;
  const independencePoints = Math.min(3, Math.max(0, assessment.independentSources - 1));
  const verificationPoints = assessment.verification === 'sources_opened' ? 1 : 0;

  return Math.min(15, tierPoints + independencePoints + verificationPoints);
}

export class WebResearchAdapter implements ResearchAdapter {
  readonly #options: WebResearchOptions;

  constructor(options: WebResearchOptions) {
    this.#options = options;
  }

  /** Research one company end to end. */
  async researchCompany(
    company: CompanyIdentity,
    client: ClientProfile,
  ): Promise<ResearchOutcome> {
    const domain = normalizeDomain(company.domain);
    if (!domain) {
      return {
        outcome: 'no_signal',
        rejection: {
          company,
          stage: 'identity',
          reason: 'no resolvable domain — identity cannot be established',
          queriesRun: [],
        },
      };
    }

    const identified: CompanyIdentity = { ...company, domain };
    const queries = buildQueries(
      identified,
      client,
      this.#options.maxQueriesPerCompany ?? 4,
    );

    const results = [];
    for (const query of queries) {
      results.push(...(await this.#options.search.search(query)));
    }

    const extraction = await this.#options.extractor.extract({
      company: identified,
      client,
      results,
      runDate: this.#options.runDate,
    });

    if (!extraction) {
      return {
        outcome: 'no_signal',
        rejection: {
          company: identified,
          stage: 'no_trigger_found',
          reason:
            'researched across the client trigger model; no dated commercial change found',
          queriesRun: queries,
        },
      };
    }

    if (!extraction.icpRelevance.fits) {
      return {
        outcome: 'no_signal',
        rejection: {
          company: identified,
          stage: 'icp',
          reason: extraction.icpRelevance.rationale,
          queriesRun: queries,
        },
      };
    }

    const claims: Claim[] = [
      ...extraction.facts,
      ...extraction.inferences,
      extraction.hypothesis,
    ];
    const validation = validateChain(claims);

    if (!validation.valid) {
      return {
        outcome: 'no_signal',
        rejection: {
          company: identified,
          stage: 'invalid_chain',
          reason: 'the reasoning chain does not hold together',
          queriesRun: queries,
          errors: validation.errors,
        },
      };
    }

    const facts = supportingFacts(extraction.hypothesis.id, claims);
    const evidence = factsToEvidence(facts);
    const signalShape = {
      type: extraction.trigger,
      description: extraction.whatChanged,
      evidence,
    };
    const freshness = assessFreshness(signalShape, this.#options.runDate);

    if (freshness.excluded) {
      return {
        outcome: 'no_signal',
        rejection: {
          company: identified,
          stage: 'stale',
          reason: `signal found but ${freshness.reason}`,
          queriesRun: queries,
        },
      };
    }

    if (extraction.contradictions.some((c) => c.severity === 'fatal')) {
      return {
        outcome: 'no_signal',
        rejection: {
          company: identified,
          stage: 'contradiction',
          reason:
            extraction.contradictions.find((c) => c.severity === 'fatal')?.note ??
            'fatal contradiction',
          queriesRun: queries,
        },
      };
    }

    const eventDate = evidence
      .map((e) => e.signalDate)
      .filter((d): d is IsoDate => typeof d === 'string')
      .sort()
      .at(-1);

    const signal: ResearchSignal = {
      company: identified,
      trigger: extraction.trigger,
      whatChanged: extraction.whatChanged,
      ...(eventDate ? { eventDate } : {}),
      discoveredAt: this.#options.runDate,
      claims,
      facts,
      hypothesis: extraction.hypothesis,
      freshness,
      icpRelevance: extraction.icpRelevance,
      owningFunction: extraction.owningFunction,
      contradictions: extraction.contradictions,
      // Measured from the chain, not asserted by the researcher.
      inferenceDepth: validation.depth,
      queriesRun: queries,
      judgements: {
        icpFit: extraction.judgements.icpFit,
        signalStrength: extraction.judgements.signalStrength,
        commercialRelevance: extraction.judgements.commercialRelevance,
      },
      whyNow: extraction.whyNow,
      salesAngle: extraction.salesAngle,
    };

    const candidate: Candidate = {
      company: identified,
      signal: signalShape,
      icpFitNotes: extraction.icpRelevance.rationale,
      contradictions: extraction.contradictions,
      inferenceSteps: validation.depth,
      decisionMakerRole: extraction.owningFunction,
      claims,
    };

    return { outcome: 'signal', signal, candidate };
  }

  /** All outcomes from the most recent discovery pass, signals and rejections. */
  readonly outcomes: ResearchOutcome[] = [];

  async discoverTriggers(client: ClientProfile): Promise<Candidate[]> {
    this.outcomes.length = 0;

    for (const target of this.#options.targets) {
      this.outcomes.push(await this.researchCompany(target, client));
    }

    return this.outcomes
      .filter((o) => o.outcome === 'signal')
      .map((o) => o.candidate);
  }

  async assess(candidate: Candidate, _client: ClientProfile) {
    const found = this.outcomes.find(
      (o) =>
        o.outcome === 'signal' &&
        o.signal.company.domain === candidate.company.domain,
    );

    if (!found || found.outcome !== 'signal') {
      throw new Error(
        `assess() called for ${candidate.company.domain} without a research signal`,
      );
    }

    const extraction = found.signal;
    const evidenceQuality = deriveEvidenceQuality(
      extraction.claims,
      extraction.hypothesis.id,
    );

    const judgements: ScoreJudgements = {
      ...found.signal.judgements,
      evidenceQuality,
    };

    return {
      candidate,
      judgements,
      whyNow: found.signal.whyNow,
      salesAngle: found.signal.salesAngle,
    };
  }

  rejections() {
    return this.outcomes
      .filter((o) => o.outcome === 'no_signal')
      .map((o) => (o.outcome === 'no_signal' ? o.rejection : null))
      .filter((r) => r !== null);
  }

  signals(): ResearchSignal[] {
    return this.outcomes
      .filter((o) => o.outcome === 'signal')
      .map((o) => (o.outcome === 'signal' ? o.signal : null))
      .filter((s) => s !== null);
  }
}
