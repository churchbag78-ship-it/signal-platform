/**
 * The Signal pipeline.
 *
 * Stage order follows the product priority list:
 *   identity → ICP fit → trigger discovery → evidence → freshness →
 *   contradiction → hypothesis → scoring → decision-maker role →
 *   recommended action → duplicate/history
 *
 * Research stages (discovery, evidence, hypothesis) are interfaces, because
 * they need the world: a model, a search provider, a human. The judgement
 * stages (freshness, contradiction outcome, scoring, dedupe) are implemented
 * here and deterministic, because those are the parts that must behave the
 * same way on every run — that is what makes the output auditable rather than
 * merely plausible.
 *
 * Contact enrichment is NOT a stage. It happens after this pipeline produces
 * opportunities, only for those that qualify.
 */

import type {
  Candidate,
  CompanyIdentity,
  DecisionMakerRole,
  IsoDate,
  Signal,
} from './domain.ts';
import { normalizeDomain } from './domain.ts';
import { assessFreshness } from './freshness.ts';
import { scoreCandidate, type ScoreJudgements, type ScoreResult } from './scoring.ts';
import {
  checkAgainstHistory,
  type DedupeVerdict,
  type LedgerEntry,
} from './dedupe.ts';
import {
  AXIS_FLOOR,
  compareTwoAxis,
  scoreTwoAxis,
  type Quadrant,
  type TwoAxisResult,
} from './two-axis.ts';

/** What the client sells, who buys, and what has to change before they buy. */
export interface ClientProfile {
  name: string;
  domain: string;
  offerings: string[];
  /** The question that defines the signal model. */
  demandTriggers: string[];
  buyerFunctions: string[];
  disqualifiers: string[];
}

export interface RecommendedAction {
  action:
    | 'research_further'
    | 'identify_decision_maker'
    | 'draft_outreach'
    | 'call'
    | 'monitor'
    | 'nurture'
    | 'manual_review';
  rationale: string;
}

export interface Opportunity {
  company: CompanyIdentity;
  signal: Signal;
  score: ScoreResult;
  /**
   * Evidence and commercial value scored separately. Present when the run was
   * asked for two-axis scoring; the single-axis `score` is always computed so
   * the two remain directly comparable on the same run.
   */
  axes?: TwoAxisResult;
  decisionMakerRole?: DecisionMakerRole;
  recommendedAction: RecommendedAction;
  dedupe: DedupeVerdict;
  /** Why now, in the salesperson's words. */
  whyNow: string;
  salesAngle: string;
}

export interface DroppedCandidate {
  company: CompanyIdentity;
  stage: string;
  reason: string;
}

export interface RunResult {
  opportunities: Opportunity[];
  dropped: DroppedCandidate[];
  funnel: Record<string, number>;
  ledgerAdditions: LedgerEntry[];
}

/** The research half of the pipeline — supplied by the caller. */
export interface ResearchAdapter {
  /** Stage 3: what changed at companies that might matter to this client. */
  discoverTriggers(client: ClientProfile, runDate: IsoDate): Promise<Candidate[]>;
  /** Stages 4 & 7: evidence gathered, contradictions tested, hypothesis formed. */
  assess(
    candidate: Candidate,
    client: ClientProfile,
  ): Promise<{
    candidate: Candidate;
    judgements: ScoreJudgements;
    whyNow: string;
    salesAngle: string;
  }>;
}

export interface RunOptions {
  client: ClientProfile;
  runDate: IsoDate;
  ledger: LedgerEntry[];
  /** Report at most this many. Fewer is always acceptable. */
  limit: number;
  /** Below this score a candidate is not reportable. */
  reportableFloor?: number;
  /**
   * Score evidence and commercial value on separate axes, and use them for
   * reportability, ranking and the recommended action. The single-axis score
   * is still computed and carried, so a run can be read either way.
   */
  twoAxis?: boolean;
}

/**
 * The action follows from the quadrant, not from a single number.
 *
 * The one rule that is not a straight mapping: `LOW_VALUE` — well evidenced,
 * thin commercial case — recommends monitoring rather than contact, because
 * `docs/ORBITAL_COMMERCIAL_BENCHMARK.md` calls that cell "interesting, not
 * worth sales time". Reporting it is right; putting it on a call sheet is not.
 */
export function recommendActionByQuadrant(
  axes: TwoAxisResult,
  role: DecisionMakerRole | undefined,
): RecommendedAction {
  if (axes.evidence.appliedCaps.some((c) => c.reason.includes('conflicting'))) {
    return {
      action: 'manual_review',
      rationale: 'conflicting evidence must be resolved by a person before contact',
    };
  }

  const quadrant: Quadrant = axes.quadrant;

  if (quadrant === 'RESEARCH_PRIORITY') {
    return {
      action: 'research_further',
      rationale:
        `the commercial case is strong (value ${axes.value.score}) but the evidence is not yet ` +
        `there (${axes.evidence.score}) — verify before contact`,
    };
  }
  if (quadrant === 'LOW_VALUE') {
    return {
      action: 'monitor',
      rationale:
        `well evidenced (${axes.evidence.score}) but the commercial case is thin ` +
        `(value ${axes.value.score}) — interesting, not worth sales time yet`,
    };
  }
  if (quadrant === 'WATCH') {
    return {
      action: 'monitor',
      rationale: 'neither axis is strong enough to justify a call',
    };
  }
  if (!role) {
    return {
      action: 'identify_decision_maker',
      rationale: 'commercial case and evidence both hold, but the owning function is not identified',
    };
  }
  return {
    action: 'draft_outreach',
    rationale: `evidence ${axes.evidence.score} and commercial value ${axes.value.score} both hold`,
  };
}

export function recommendAction(
  score: ScoreResult,
  role: DecisionMakerRole | undefined,
): RecommendedAction {
  if (score.appliedCaps.some((c) => c.reason.includes('conflicting'))) {
    return {
      action: 'manual_review',
      rationale: 'conflicting evidence must be resolved by a person before contact',
    };
  }
  if (score.evidence.verification === 'search_snippet') {
    return {
      action: 'research_further',
      rationale: 'evidence is snippet-level; retrieve and verify the pages before contacting',
    };
  }
  if (!role) {
    return {
      action: 'identify_decision_maker',
      rationale: 'commercial case stands but the owning function is not yet identified',
    };
  }
  if (score.classification === 'CONFIRMED_OPPORTUNITY') {
    return { action: 'draft_outreach', rationale: 'evidence, timing and fit all hold' };
  }
  if (score.classification === 'PROBABLE_OPPORTUNITY') {
    return { action: 'call', rationale: 'strong enough to open a conversation' };
  }
  return { action: 'monitor', rationale: 'plausible but not yet actionable' };
}

export async function runPipeline(
  adapter: ResearchAdapter,
  options: RunOptions,
): Promise<RunResult> {
  const { client, runDate, ledger, limit } = options;
  const floor = options.reportableFloor ?? 45;
  const twoAxis = options.twoAxis ?? false;

  const dropped: DroppedCandidate[] = [];
  const funnel: Record<string, number> = {};

  // Stage 3 — commercial trigger discovery.
  const candidates = await adapter.discoverTriggers(client, runDate);
  funnel.discovered = candidates.length;

  // Stage 1 — identity resolution. Domain is the key; anything without one
  // cannot be de-duplicated or tracked, so it cannot enter the pipeline.
  const identified: Candidate[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const domain = normalizeDomain(candidate.company.domain);
    if (!domain) {
      dropped.push({
        company: candidate.company,
        stage: 'identity',
        reason: 'no resolvable domain — cannot establish identity',
      });
      continue;
    }
    if (seen.has(domain)) {
      dropped.push({
        company: candidate.company,
        stage: 'identity',
        reason: 'duplicate of another candidate in this run',
      });
      continue;
    }
    seen.add(domain);
    identified.push({ ...candidate, company: { ...candidate.company, domain } });
  }
  funnel.identified = identified.length;

  // Stage 5 — freshness, before spending any assessment effort on stale news.
  const fresh = identified.filter((candidate) => {
    const freshness = assessFreshness(candidate.signal, runDate);
    if (freshness.excluded) {
      dropped.push({
        company: candidate.company,
        stage: 'freshness',
        reason: freshness.reason,
      });
      return false;
    }
    return true;
  });
  funnel.fresh = fresh.length;

  // Stages 4, 6, 7, 8 — evidence, contradiction, hypothesis, scoring.
  const scored: Opportunity[] = [];
  for (const candidate of fresh) {
    const assessed = await adapter.assess(candidate, client);
    const score = scoreCandidate(assessed.candidate, assessed.judgements, runDate);
    // Always computed, so one run can be read on either model.
    const axes = scoreTwoAxis(assessed.candidate, assessed.judgements, runDate);

    if (score.excluded) {
      dropped.push({
        company: candidate.company,
        stage: 'contradiction',
        reason: score.explanation.at(-1) ?? 'excluded',
      });
      continue;
    }
    if (twoAxis) {
      if (!axes.reportable) {
        dropped.push({
          company: candidate.company,
          stage: 'scoring',
          reason:
            `evidence ${axes.evidence.score}, value ${axes.value.score} — ` +
            `neither axis clears the ${AXIS_FLOOR}-point floor`,
        });
        continue;
      }
    } else if (score.total < floor) {
      dropped.push({
        company: candidate.company,
        stage: 'scoring',
        reason: `scored ${score.total}, below reportable floor ${floor}`,
      });
      continue;
    }

    // Stage 11 — duplicate and history handling.
    const dedupe = checkAgainstHistory(assessed.candidate, ledger);
    if (dedupe.action === 'exclude') {
      dropped.push({
        company: candidate.company,
        stage: 'dedupe',
        reason: dedupe.reason,
      });
      continue;
    }

    scored.push({
      company: assessed.candidate.company,
      signal: assessed.candidate.signal,
      score,
      axes,
      decisionMakerRole: assessed.candidate.decisionMakerRole,
      recommendedAction: twoAxis
        ? recommendActionByQuadrant(axes, assessed.candidate.decisionMakerRole)
        : recommendAction(score, assessed.candidate.decisionMakerRole),
      dedupe,
      whyNow: assessed.whyNow,
      salesAngle: assessed.salesAngle,
    });
  }
  funnel.scored = scored.length;

  // Ranking is a commercial question, so under two axes value orders first and
  // evidence breaks ties.
  scored.sort((a, b) =>
    twoAxis && a.axes && b.axes
      ? compareTwoAxis(a.axes, b.axes)
      : b.score.total - a.score.total,
  );

  // Never pad to the requested number. Returning fewer is the correct
  // behaviour when fewer qualify.
  const opportunities = scored.slice(0, limit);
  funnel.reported = opportunities.length;

  const ledgerAdditions: LedgerEntry[] = opportunities.map((o) => ({
    runDate,
    company: o.company.name,
    domain: o.company.domain,
    signalType: o.signal.type,
    signalDate: o.score.freshness.ageDays === null
      ? ''
      : (o.signal.evidence.find((e) => e.signalDate)?.signalDate ?? ''),
    score: o.score.total,
    confidence: o.score.confidence,
  }));

  return { opportunities, dropped, funnel, ledgerAdditions };
}
