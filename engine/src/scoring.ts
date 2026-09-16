/**
 * Commercial scoring — docs/RESEARCH_METHODOLOGY.md §6.
 *
 * The score must be explainable, not an opaque number: every result carries
 * the component breakdown, the caps that bit, and a human-readable line for
 * each. A salesperson who disagrees with a score should be able to see exactly
 * which judgement they disagree with.
 *
 * v0.3 note — the decision-maker component scores identification of the
 * FUNCTION that owns the problem, which is reasoning and always achievable.
 * Person-level contact data is a downstream enrichment layer and deliberately
 * carries no score weight, so a missing contact provider can never suppress an
 * opportunity.
 */

import type {
  Candidate,
  Confidence,
  DecisionState,
  IsoDate,
} from './domain.ts';
import { assessEvidence, type EvidenceAssessment } from './evidence.ts';
import { assessFreshness, type FreshnessResult } from './freshness.ts';
import { changeIsDated } from './dating.ts';

/** Judgement inputs the researcher supplies; recency is computed. */
export interface ScoreJudgements {
  /** 0-25. Industry, size, geography and buying structure all match. */
  icpFit: number;
  /** 0-20. How directly the signal implies demand for THIS client's offer. */
  signalStrength: number;
  /** 0-15. Source tier and independence. */
  evidenceQuality: number;
  /** 0-15. A specific, articulable "why now" with a plausible deal behind it. */
  commercialRelevance: number;
}

export const COMPONENT_MAX = {
  icpFit: 25,
  signalStrength: 20,
  recency: 15,
  evidenceQuality: 15,
  commercialRelevance: 15,
  decisionMakerRole: 10,
} as const;

export interface AppliedCap {
  cap: number;
  reason: string;
}

export interface ScoreResult {
  total: number;
  /** Before caps and penalties. */
  raw: number;
  components: Record<keyof typeof COMPONENT_MAX, number>;
  penalties: { points: number; reason: string }[];
  appliedCaps: AppliedCap[];
  classification: DecisionState;
  confidence: Confidence;
  excluded: boolean;
  /** One line per contribution, in report order. */
  explanation: string[];
  evidence: EvidenceAssessment;
  freshness: FreshnessResult;
}

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(Math.round(value), max));
}

/** Caps that apply mechanically, so they cannot be forgotten under pressure. */
export function applicableCaps(
  candidate: Candidate,
  evidence: EvidenceAssessment,
): AppliedCap[] {
  const caps: AppliedCap[] = [];

  if (evidence.verification === 'search_snippet') {
    caps.push({ cap: 70, reason: 'evidence is search-snippet level; no page was retrieved and verified' });
  }
  if (evidence.independentSources <= 1 && evidence.bestTier === 3) {
    caps.push({ cap: 75, reason: 'single trade-press source' });
  }
  if (!changeIsDated(candidate, evidence.hasDate)) {
    caps.push({
      cap: 65,
      reason:
        candidate.signal.changeDate === null
          ? 'no date established for the change — the dates found belong to something else'
          : 'no signal date established',
    });
  }
  if (evidence.bestTier >= 4) {
    caps.push({ cap: 50, reason: 'aggregator or social sources only' });
  }
  if (candidate.contradictions.some((c) => c.severity === 'conflicting')) {
    caps.push({ cap: 60, reason: 'conflicting evidence — review required' });
  }

  return caps;
}

function confidenceCeiling(
  candidate: Candidate,
  evidence: EvidenceAssessment,
): Confidence {
  const hasConflict = candidate.contradictions.some((c) => c.severity === 'conflicting');

  if (hasConflict || evidence.bestTier >= 4 || candidate.inferenceSteps > 2) {
    return 'Low';
  }
  if (
    evidence.verification === 'search_snippet' ||
    !evidence.hasDate ||
    evidence.independentSources <= 1
  ) {
    return 'Medium';
  }
  if (evidence.bestTier > 2) return 'Medium';
  return 'High';
}

export function classify(total: number): DecisionState {
  if (total >= 75) return 'CONFIRMED_OPPORTUNITY';
  if (total >= 60) return 'PROBABLE_OPPORTUNITY';
  if (total >= 45) return 'HYPOTHESIS';
  return 'INSUFFICIENT_EVIDENCE';
}

export function scoreCandidate(
  candidate: Candidate,
  judgements: ScoreJudgements,
  runDate: IsoDate,
): ScoreResult {
  const evidence = assessEvidence(candidate.signal.evidence);
  const freshness = assessFreshness(candidate.signal, runDate);

  const components = {
    icpFit: clamp(judgements.icpFit, COMPONENT_MAX.icpFit),
    signalStrength: clamp(judgements.signalStrength, COMPONENT_MAX.signalStrength),
    recency: clamp(freshness.points, COMPONENT_MAX.recency),
    evidenceQuality: clamp(judgements.evidenceQuality, COMPONENT_MAX.evidenceQuality),
    commercialRelevance: clamp(
      judgements.commercialRelevance,
      COMPONENT_MAX.commercialRelevance,
    ),
    // Role identification is reasoning, not contact data.
    decisionMakerRole: candidate.decisionMakerRole
      ? COMPONENT_MAX.decisionMakerRole
      : 0,
  };

  const raw = Object.values(components).reduce((a, b) => a + b, 0);

  const penalties: { points: number; reason: string }[] = [];
  const extraInference = Math.max(0, candidate.inferenceSteps - 1);
  if (extraInference > 0) {
    penalties.push({
      points: extraInference * 10,
      reason: `${extraInference} extra inference step(s) between signal and need`,
    });
  }

  const afterPenalties = Math.max(
    0,
    raw - penalties.reduce((a, p) => a + p.points, 0),
  );

  const appliedCaps = applicableCaps(candidate, evidence);
  const total = appliedCaps.reduce((acc, c) => Math.min(acc, c.cap), afterPenalties);

  const fatal = candidate.contradictions.some((c) => c.severity === 'fatal');
  const excluded = fatal || freshness.excluded;

  const ceiling = confidenceCeiling(candidate, evidence);
  const rank: Confidence[] = ['Low', 'Medium', 'High'];
  const byScore: Confidence = total >= 75 ? 'High' : total >= 60 ? 'Medium' : 'Low';
  const confidence =
    rank.indexOf(byScore) < rank.indexOf(ceiling) ? byScore : ceiling;

  const explanation: string[] = [
    `+ ICP fit ${components.icpFit}/${COMPONENT_MAX.icpFit}`,
    `+ signal strength ${components.signalStrength}/${COMPONENT_MAX.signalStrength}`,
    `+ recency ${components.recency}/${COMPONENT_MAX.recency} (${freshness.reason})`,
    `+ evidence quality ${components.evidenceQuality}/${COMPONENT_MAX.evidenceQuality} ` +
      `(best tier ${evidence.bestTier}, ${evidence.independentSources} independent source(s))`,
    `+ commercial relevance ${components.commercialRelevance}/${COMPONENT_MAX.commercialRelevance}`,
    candidate.decisionMakerRole
      ? `+ decision-maker role ${components.decisionMakerRole}/${COMPONENT_MAX.decisionMakerRole} (${candidate.decisionMakerRole.function})`
      : `+ decision-maker role 0/${COMPONENT_MAX.decisionMakerRole} (function not identified)`,
    ...penalties.map((p) => `- ${p.points} ${p.reason}`),
    ...appliedCaps.map((c) => `capped at ${c.cap} — ${c.reason}`),
    `= ${excluded ? 'EXCLUDED' : total}`,
  ];

  if (excluded) {
    explanation.push(
      fatal ? 'excluded: fatal contradiction' : `excluded: ${freshness.reason}`,
    );
  }

  return {
    total: excluded ? 0 : total,
    raw,
    components,
    penalties,
    appliedCaps,
    classification: excluded ? 'INSUFFICIENT_EVIDENCE' : classify(total),
    confidence: excluded ? 'Low' : confidence,
    excluded,
    explanation,
    evidence,
    freshness,
  };
}
