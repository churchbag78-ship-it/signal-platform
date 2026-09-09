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
  IsoDate,
} from '../domain.ts';
import { normalizeDomain, toCompanyIdentity } from '../domain.ts';
import {
  factsToEvidence,
  pruneChain,
  supportingFacts,
  validateChain,
} from '../claims.ts';
import { ownedDomains } from '../identity.ts';
import { promoteToFact, validatePolarity } from './extraction.ts';
import { verifyClaimPassage, NullPageRetriever, type PageRetriever, type VerificationResult } from './retrieval.ts';
import { assessFreshness } from '../freshness.ts';
import { assessEvidence } from '../evidence.ts';
import type { ClientProfile, ResearchAdapter } from '../pipeline.ts';
import type { ScoreJudgements } from '../scoring.ts';
import type {
  ClaimExtractor,
  ResearchOutcome,
  ResearchSignal,
  SearchClient,
  SearchResult,
  RejectionStage as NoSignalStage,
} from './types.ts';
import {
  planFamilyQueries,
  type ChangeFamilyId,
  type PlannedQuery,
} from './change-families.ts';
import {
  sweepFirstParty,
  SWEPT_SECTIONS,
  type FirstPartySection,
  type FirstPartySweep,
} from './first-party.ts';
import {
  mergeRecords,
  type HistoryStore,
  type ResearchCoverage,
  type ResearchRecord,
  type ResearchState,
} from './history.ts';

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
  /**
   * Fetches the page behind a claim so its supporting passage can be checked
   * against the real body. Defaults to a retriever that declares itself
   * blocked, which leaves every claim at snippet level — never promoted by
   * default, and never silently.
   */
  retriever?: PageRetriever;
  /**
   * `change_family` (default) plans queries across the commercial change
   * families and sweeps the company's own sources first. `template` reproduces
   * the two fixed queries the v4 engine ran, and exists only so earlier runs
   * stay replayable for comparison.
   */
  queryStrategy?: 'change_family' | 'template';
  /** Change-family queries per company. Search is the expensive part. */
  familyBudget?: number;
  /** Restrict the plan to these families. Defaults to all of them. */
  families?: ChangeFamilyId[];
  /** First-party sections to sweep. Unswept sections are recorded as unchecked. */
  firstPartySections?: FirstPartySection[];
  /** Cap on direct first-party page fetches per company. */
  maxFirstPartyPaths?: number;
  /** Durable research state. Optional: without it, a run remembers nothing. */
  history?: HistoryStore;
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

/**
 * The durable state a rejection stage represents.
 *
 * `research_failure` is kept apart from every genuine negative on purpose: a
 * company whose research could not run must never look like a company that was
 * checked and found quiet.
 */
export function rejectionState(stage: NoSignalStage): ResearchState {
  switch (stage) {
    case 'icp':
      return 'disqualified';
    case 'no_trigger_found':
      return 'no_trigger_found';
    case 'no_commercial_consequence':
      return 'no_commercial_consequence';
    case 'identity_collision':
      return 'identity_collision';
    case 'identity':
    case 'identity_unresolved':
      return 'identity_unresolved';
    case 'research_failure':
      return 'research_failure';
    default:
      // stale, contradiction, invalid_chain, invalid_claims, insufficient_evidence
      return 'insufficient_evidence';
  }
}

/** Evidence quality derived from what the sources actually are. */
export function deriveEvidenceQuality(claims: Claim[], hypothesisId: string): number {
  const facts = supportingFacts(hypothesisId, claims);
  if (facts.length === 0) return 0;

  const assessment = assessEvidence(factsToEvidence(facts));

  const tierPoints = { 1: 11, 2: 10, 3: 7, 4: 3, 5: 1 }[assessment.bestTier] ?? 1;
  const independencePoints = Math.min(3, Math.max(0, assessment.independentSources - 1));
  const verificationPoints = assessment.verification === 'page_retrieved' ? 1 : 0;

  return Math.min(15, tierPoints + independencePoints + verificationPoints);
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

    const retriever = this.#options.retriever ?? new NullPageRetriever();
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

    // --- DISCOVERY -------------------------------------------------------
    // Mandatory first-party sweep, then change-family queries. Discovery only
    // decides what the engine LOOKS at; every judgement downstream — identity,
    // source authority, verification, polarity, epistemic level — is unchanged.
    const strategy = this.#options.queryStrategy ?? 'change_family';

    let sweep: FirstPartySweep | null = null;
    const plan: PlannedQuery[] = [];

    if (strategy === 'template') {
      const legacy = buildQueries(target, client, this.#options.maxQueriesPerCompany ?? 4, {
        disambiguate: this.#options.disambiguateQueries ?? true,
      });
      plan.push(
        ...legacy.map((query, index) => ({
          query,
          kind: 'change_family' as const,
          priority: index,
        })),
      );
    } else {
      const sections = this.#options.firstPartySections ?? SWEPT_SECTIONS;
      sweep = await sweepFirstParty({
        target,
        retriever,
        search: this.#options.search,
        sections,
        maxPaths: this.#options.maxFirstPartyPaths ?? 0,
      });
      plan.push(
        ...planFamilyQueries(target, client, {
          familyBudget: this.#options.familyBudget,
          families: this.#options.families,
        }),
      );
    }

    // A query the transport cannot execute is a COVERAGE failure. Recording it
    // as an empty result would manufacture "we looked and found nothing",
    // which is the one negative that must always be real.
    const results: SearchResult[] = sweep ? [...sweep.results] : [];
    const executed: PlannedQuery[] = sweep ? [...sweep.queries] : [];
    const unexecuted: { query: string; reason: string }[] = [];

    for (const planned of plan) {
      try {
        results.push(...(await this.#options.search.search(planned.query)));
        executed.push(planned);
      } catch (error) {
        unexecuted.push({
          query: planned.query,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const queries = executed.map((q) => q.query);
    const familiesChecked = executed
      .map((q) => q.family)
      .filter((f): f is ChangeFamilyId => f !== undefined);

    const coverage: ResearchCoverage = {
      familiesChecked,
      firstPartySectionsCovered: sweep?.sectionsCovered ?? [],
      firstPartySectionsUnchecked: sweep?.sectionsUnchecked ?? [],
      firstPartyPathsAttempted: sweep?.paths.length ?? 0,
      firstPartyPathsRetrieved: sweep?.paths.filter((p) => p.outcome === 'retrieved').length ?? 0,
      firstPartySourcesFound: sweep?.sourcesFound ?? 0,
      firstPartyQueriesRun: sweep?.queries.length ?? 0,
      retrievalBlocked: sweep?.retrievalBlocked ?? false,
      queriesRun: queries,
      sourcesSeen: results.length,
    };

    this.coverageByDomain.set(domain, coverage);
    this.unexecutedByDomain.set(domain, unexecuted);

    if (executed.length === 0) {
      return {
        outcome: 'no_signal',
        rejection: {
          company,
          stage: 'research_failure',
          reason:
            `no query in the plan could be executed (${unexecuted.length} failed). ` +
            'This is a coverage failure, not a finding about the company.',
          queriesRun: [],
          coverage,
          errors: unexecuted.map((u) => `${u.query}: ${u.reason}`),
        },
      };
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
          coverage,
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
          coverage,
        },
      };
    }

    // --- VERIFICATION -----------------------------------------------------
    // search result -> retrieved page -> extractor -> classification ->
    // identity gate -> Fact. A claim earns `page_retrieved` only when the page
    // was fetched AND its supporting passage was found in the body. Anything
    // else stays at snippet level with the reason recorded.
    const verifications: VerificationResult[] = [];
    const verifiedClaims = [];

    for (const extractedClaim of extraction.claims) {
      const verification = await verifyClaimPassage(
        extractedClaim.sourceUrl,
        extractedClaim.supportingPassage,
        retriever,
      );
      verifications.push(verification);
      verifiedClaims.push({ ...extractedClaim, verification: verification.level });
    }

    // --- CLAIM PROMOTION AND IDENTITY GATE -------------------------------
    // Extractors produce structured claims, never Facts. Each claim is
    // schema-validated, its source classified in the context of the claim's
    // topic, and its attributes put through the identity gate. Only then does
    // it become a Fact. A Fact without a valid source cannot be constructed.
    const accepted: Fact[] = [];
    const rejectedIds = new Set<string>();
    const identityRejections: { url: string; status: string; explanation: string }[] = [];
    const claimErrors: string[] = [];
    let collisions = 0;

    for (const extractedClaim of verifiedClaims) {
      const outcome = promoteToFact(extractedClaim, target, this.#options.runDate);

      if (outcome.status === 'promoted') {
        accepted.push(outcome.fact);
        continue;
      }

      rejectedIds.add(extractedClaim.id);

      if (outcome.status === 'invalid') {
        claimErrors.push(...outcome.errors);
        identityRejections.push({
          url: extractedClaim.sourceUrl,
          status: 'invalid_claim',
          explanation: outcome.errors.join('; '),
        });
        continue;
      }

      identityRejections.push({
        url: extractedClaim.sourceUrl,
        status: outcome.verdict.status,
        explanation: outcome.verdict.explanation,
      });
      if (outcome.verdict.status === 'identity_collision') collisions += 1;
    }

    if (accepted.length === 0) {
      const onlySchemaFailures = claimErrors.length > 0 && identityRejections.every(
        (r) => r.status === 'invalid_claim',
      );

      return {
        outcome: 'no_signal',
        rejection: {
          company,
          stage: onlySchemaFailures
            ? 'invalid_claims'
            : collisions > 0
              ? 'identity_collision'
              : 'identity_unresolved',
          reason: onlySchemaFailures
            ? 'every extracted claim failed validation'
            : collisions > 0
              ? 'every source describes a different company with a similar name'
              : 'no source could be confidently attributed to this company',
          queriesRun: queries,
          coverage,
          ...(claimErrors.length > 0 ? { errors: claimErrors } : {}),
          identityRejections,
        },
      };
    }

    // Polarity is an extracted judgement, checked against the evidence rather
    // than trusted. Warnings travel with the signal; they do not silently
    // rewrite it.
    const polarityCheck = validatePolarity(
      verifiedClaims.filter((c) => !rejectedIds.has(c.id)),
      extraction.polarity,
      extraction.polarityRationale,
    );

    const fullChain: Claim[] = [...accepted, ...extraction.inferences, extraction.hypothesis];
    // Conclusions drawn from a rejected source must not outlive it.
    const claims = pruneChain(fullChain, rejectedIds);

    if (!claims.some((c) => c.id === extraction.hypothesis.id)) {
      return {
        outcome: 'no_signal',
        rejection: {
          company,
          stage: 'identity_unresolved',
          reason:
            'the commercial hypothesis rested entirely on sources that could not be attributed to this company',
          queriesRun: queries,
          coverage,
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
          coverage,
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
          coverage,
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
          coverage,
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
          coverage,
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
      polarityRationale: extraction.polarityRationale,
      polarityWarnings: polarityCheck.warnings,
      verifications,
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
      coverage,
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

    return { outcome: 'signal', signal, candidate };
  }

  readonly outcomes: ResearchOutcome[] = [];
  /** Coverage per company, kept whatever the outcome was. */
  readonly coverageByDomain = new Map<string, ResearchCoverage>();
  /** Planned queries the transport could not execute, per company. */
  readonly unexecutedByDomain = new Map<string, { query: string; reason: string }[]>();
  /** Companies previously researched that this run's target list omits. */
  droppedFromUniverse: ResearchRecord[] = [];

  async discoverTriggers(client: ClientProfile): Promise<Candidate[]> {
    this.outcomes.length = 0;
    this.coverageByDomain.clear();
    this.unexecutedByDomain.clear();

    for (const target of this.#options.targets) {
      this.outcomes.push(await this.researchCompany(target, client));
    }

    await this.#persist();

    return this.outcomes.filter((o) => o.outcome === 'signal').map((o) => o.candidate);
  }

  /**
   * Write this run's state to the history store. A company researched once
   * stays in the universe: `droppedFromUniverse` reports anything the store
   * knows about that this run's target list omitted, so a target cannot leave
   * silently the way ADS Laser did between v1 and v2.
   */
  async #persist(): Promise<void> {
    const store = this.#options.history;
    if (!store) return;

    const stored = await store.load();
    const records = this.outcomes.map((outcome) => this.#recordFor(outcome));
    const merged = mergeRecords(stored, records);

    const targetDomains = this.#options.targets
      .map((t) => normalizeDomain(t.canonicalDomain))
      .filter(Boolean);
    this.droppedFromUniverse = merged.filter(
      (record) => !targetDomains.includes(record.domain.toLowerCase()),
    );

    await store.save(merged);
  }

  #recordFor(outcome: ResearchOutcome): ResearchRecord {
    const company = outcome.outcome === 'signal' ? outcome.signal.company : outcome.rejection.company;
    const runDate = this.#options.runDate;
    const emptyCoverage: ResearchCoverage = {
      familiesChecked: [],
      firstPartySectionsCovered: [],
      firstPartySectionsUnchecked: [],
      firstPartyPathsAttempted: 0,
      firstPartyPathsRetrieved: 0,
      firstPartySourcesFound: 0,
      firstPartyQueriesRun: 0,
      retrievalBlocked: false,
      queriesRun: [],
      sourcesSeen: 0,
    };
    const coverage =
      this.coverageByDomain.get(company.domain) ??
      (outcome.outcome === 'signal' ? outcome.signal.coverage : outcome.rejection.coverage) ??
      emptyCoverage;

    const state: ResearchState =
      outcome.outcome === 'signal' ? 'signal_found' : rejectionState(outcome.rejection.stage);
    const reason =
      outcome.outcome === 'signal'
        ? `${outcome.signal.trigger}: ${outcome.signal.whatChanged}`
        : outcome.rejection.reason;

    return {
      domain: company.domain,
      company: company.name,
      state,
      reason,
      lastCheckedAt: runDate,
      ...(outcome.outcome === 'signal'
        ? {
            trigger: outcome.signal.trigger,
            ...(outcome.signal.eventDate ? { signalDate: outcome.signal.eventDate } : {}),
          }
        : {}),
      coverage,
      evidence:
        outcome.outcome === 'signal'
          ? outcome.signal.facts.map((fact) => ({
              url: fact.source.url,
              publisher: fact.source.publisher,
              tier: fact.source.tier,
              verification: fact.verification,
              ...(fact.eventDate ? { eventDate: fact.eventDate } : {}),
            }))
          : [],
      history: [
        {
          runDate,
          state,
          reason,
          queries: coverage.queriesRun.length,
          sourcesSeen: coverage.sourcesSeen,
        },
      ],
      timesResearched: 1,
    };
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
