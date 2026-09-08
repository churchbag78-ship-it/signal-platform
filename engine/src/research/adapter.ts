/**
 * The research loop: company fingerprint in, source-backed commercial signal
 * out.
 *
 * Company → verified change → commercial implication → client relevance →
 * opportunity score → recommended sales action. Every link is either sourced
 * or explicitly labelled as reasoning, and no source speaks for a company
 * until it has been attributed to that company's identity fingerprint.
 */

import type {
  Candidate,
  Claim,
  CompanyIdentity,
  Fact,
  IdentityFingerprint,
  IdentityVerdict,
  IsoDate,
  SourceAttribution,
} from '../domain.ts';
import { normalizeDomain, toCompanyIdentity } from '../domain.ts';
import {
  factsToEvidence,
  isFact,
  pruneChain,
  supportingFacts,
  validateChain,
} from '../claims.ts';
import { attributeSource, ownedDomains } from '../identity.ts';
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
  /** Companies to research this run, as full identity fingerprints. */
  targets: IdentityFingerprint[];
  runDate: IsoDate;
  /** Queries per company. Kept small — search is the expensive part. */
  maxQueriesPerCompany?: number;
  /**
   * Append distinguishing context to every query. Defaults to true.
   * Set false only to replay a capture taken before the fix.
   */
  disambiguateQueries?: boolean;
  /**
   * Optional cheap screen run BEFORE any search. Returning a reason rejects
   * the company without spending a single query. Purely a cost control: it
   * can only reject on what the client profile already disqualifies, never
   * decide that something is an opportunity.
   */
  prescreen?: (company: CompanyIdentity, client: ClientProfile) => string | null;
}

/**
 * Query generation is driven by the CLIENT's demand triggers and the TARGET's
 * distinguishing attributes.
 *
 * A bare company name collides with same-named businesses worldwide — the live
 * Pilot A run lost three of seven companies that way. Disambiguation reduces
 * that, but it is only the first line of defence; source-level identity
 * validation in `researchCompany` is the one that must not be skipped.
 */
export function buildQueries(
  target: IdentityFingerprint,
  client: ClientProfile,
  limit = 4,
  options: { disambiguate?: boolean } = {},
): string[] {
  const name = target.canonicalName;
  const tidy = (query: string) => query.replace(/\s+/g, ' ').trim();

  if (options.disambiguate === false) {
    const location = target.geography?.town ?? '';
    return [
      tidy(`${name} ${location} news announcement expansion contract`),
      ...client.demandTriggers.map((trigger) => tidy(`${name} ${trigger}`)),
      tidy(`${name} administration closure delayed cancelled loss`),
    ].slice(0, limit);
  }

  // Strongest available distinguishing context, most specific first.
  const qualifier =
    target.geography?.town ??
    target.geography?.region ??
    target.industry ??
    target.descriptors?.[0] ??
    target.geography?.country ??
    '';

  return [
    tidy(`${name} ${qualifier} news announcement expansion contract`),
    ...client.demandTriggers.map((trigger) => tidy(`${name} ${qualifier} ${trigger}`)),
    tidy(`${name} ${qualifier} administration closure restructuring relocation`),
  ].slice(0, limit);
}

/** Evidence quality derived from what the sources actually are. */
export function deriveEvidenceQuality(claims: Claim[], hypothesisId: string): number {
  const facts = supportingFacts(hypothesisId, claims);
  if (facts.length === 0) return 0;

  const assessment = assessEvidence(factsToEvidence(facts));

  const tierPoints = { 1: 11, 2: 10, 3: 7, 4: 3, 5: 1 }[assessment.bestTier] ?? 1;
  const independencePoints = Math.min(3, Math.max(0, assessment.independentSources - 1));
  const verificationPoints = assessment.verification === 'sources_opened' ? 1 : 0;

  return Math.min(15, tierPoints + independencePoints + verificationPoints);
}

/**
 * Falls back to the source URL when an extractor supplied no attribution.
 * A source with no attribution can still be resolved by its host, but it can
 * never reach "match" on name alone — which is the point.
 */
function attributionFor(fact: Fact): SourceAttribution {
  return fact.attribution ?? { url: fact.source.url };
}

export class WebResearchAdapter implements ResearchAdapter {
  readonly #options: WebResearchOptions;

  constructor(options: WebResearchOptions) {
    this.#options = options;
  }

  async researchCompany(
    target: IdentityFingerprint,
    client: ClientProfile,
  ): Promise<ResearchOutcome> {
    const domain = normalizeDomain(target.canonicalDomain);
    const company = toCompanyIdentity(target);

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

    const prescreenReason = this.#options.prescreen?.(company, client);
    if (prescreenReason) {
      return {
        outcome: 'no_signal',
        rejection: {
          company,
          stage: 'icp',
          reason: `${prescreenReason} (rejected before search — no research spent)`,
          queriesRun: [],
        },
      };
    }

    const queries = buildQueries(target, client, this.#options.maxQueriesPerCompany ?? 4, {
      disambiguate: this.#options.disambiguateQueries ?? true,
    });

    const results = [];
    for (const query of queries) {
      results.push(...(await this.#options.search.search(query)));
    }

    const extraction = await this.#options.extractor.extract({
      company,
      client,
      results,
      runDate: this.#options.runDate,
    });

    if (!extraction) {
      return {
        outcome: 'no_signal',
        rejection: {
          company,
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
          company,
          stage: 'icp',
          reason: extraction.icpRelevance.rationale,
          queriesRun: queries,
        },
      };
    }

    // --- IDENTITY GATE ----------------------------------------------------
    // Nothing reaches the evidence corpus until it has been attributed to this
    // company. A matching name is never sufficient on its own.
    const owned = ownedDomains(target);
    const accepted: Fact[] = [];
    const rejectedIds = new Set<string>();
    const identityRejections: { url: string; status: string; explanation: string }[] = [];
    let collisions = 0;

    for (const fact of extraction.facts) {
      const verdict: IdentityVerdict = attributeSource(target, attributionFor(fact));

      if (verdict.status === 'match') {
        accepted.push({ ...fact, identity: verdict });
        continue;
      }

      rejectedIds.add(fact.id);
      identityRejections.push({
        url: fact.source.url,
        status: verdict.status,
        explanation: verdict.explanation,
      });
      if (verdict.status === 'identity_collision') collisions += 1;
    }

    if (accepted.length === 0) {
      const collision = collisions > 0;
      return {
        outcome: 'no_signal',
        rejection: {
          company,
          stage: collision ? 'identity_collision' : 'identity_unresolved',
          reason: collision
            ? 'every source describes a different company with a similar name'
            : 'no source could be confidently attributed to this company',
          queriesRun: queries,
          identityRejections,
        },
      };
    }

    const fullChain: Claim[] = [
      ...extraction.facts,
      ...extraction.inferences,
      extraction.hypothesis,
    ];
    // Conclusions drawn from a rejected source must not outlive it.
    const claims = pruneChain(fullChain, rejectedIds).map((claim) =>
      isFact(claim) ? (accepted.find((f) => f.id === claim.id) ?? claim) : claim,
    );

    if (!claims.some((c) => c.id === extraction.hypothesis.id)) {
      return {
        outcome: 'no_signal',
        rejection: {
          company,
          stage: 'identity_unresolved',
          reason:
            'the commercial hypothesis rested entirely on sources that could not be attributed to this company',
          queriesRun: queries,
          identityRejections,
        },
      };
    }

    const validation = validateChain(claims);
    if (!validation.valid) {
      return {
        outcome: 'no_signal',
        rejection: {
          company,
          stage: 'invalid_chain',
          reason: 'the reasoning chain does not hold together',
          queriesRun: queries,
          errors: validation.errors,
          identityRejections,
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
          company,
          stage: 'stale',
          reason: `signal found but ${freshness.reason}`,
          queriesRun: queries,
          identityRejections,
        },
      };
    }

    // A change can be real, current and well-sourced and STILL not create
    // anything this client can act on. Contraction, closure and withdrawal are
    // valid signal types; whether they are opportunities depends on the client.
    if (!extraction.consequence.actionable) {
      return {
        outcome: 'no_signal',
        rejection: {
          company,
          stage: 'no_commercial_consequence',
          reason: extraction.consequence.rationale,
          queriesRun: queries,
          identityRejections,
        },
      };
    }

    if (extraction.contradictions.some((c) => c.severity === 'fatal')) {
      return {
        outcome: 'no_signal',
        rejection: {
          company,
          stage: 'contradiction',
          reason:
            extraction.contradictions.find((c) => c.severity === 'fatal')?.note ??
            'fatal contradiction',
          queriesRun: queries,
          identityRejections,
        },
      };
    }

    const eventDate = evidence
      .map((e) => e.signalDate)
      .filter((d): d is IsoDate => typeof d === 'string')
      .sort()
      .at(-1);

    const signal: ResearchSignal = {
      company,
      trigger: extraction.trigger,
      whatChanged: extraction.whatChanged,
      ...(eventDate ? { eventDate } : {}),
      discoveredAt: this.#options.runDate,
      polarity: extraction.polarity,
      consequence: extraction.consequence,
      identityRejections,
      claims,
      facts,
      hypothesis: extraction.hypothesis,
      freshness,
      icpRelevance: extraction.icpRelevance,
      owningFunction: extraction.owningFunction,
      contradictions: extraction.contradictions,
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
      company,
      signal: signalShape,
      icpFitNotes: extraction.icpRelevance.rationale,
      contradictions: extraction.contradictions,
      inferenceSteps: validation.depth,
      decisionMakerRole: extraction.owningFunction,
      claims,
    };

    void owned;
    return { outcome: 'signal', signal, candidate };
  }

  readonly outcomes: ResearchOutcome[] = [];

  async discoverTriggers(client: ClientProfile): Promise<Candidate[]> {
    this.outcomes.length = 0;

    for (const target of this.#options.targets) {
      this.outcomes.push(await this.researchCompany(target, client));
    }

    return this.outcomes.filter((o) => o.outcome === 'signal').map((o) => o.candidate);
  }

  async assess(candidate: Candidate, _client: ClientProfile) {
    const found = this.outcomes.find(
      (o) => o.outcome === 'signal' && o.signal.company.domain === candidate.company.domain,
    );

    if (!found || found.outcome !== 'signal') {
      throw new Error(
        `assess() called for ${candidate.company.domain} without a research signal`,
      );
    }

    const judgements: ScoreJudgements = {
      ...found.signal.judgements,
      evidenceQuality: deriveEvidenceQuality(found.signal.claims, found.signal.hypothesis.id),
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
