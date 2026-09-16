/**
 * Two-axis scoring: how well proven, and how much worth pursuing.
 *
 * The single-axis model fused two independent questions into one number, and
 * the commercial benchmark showed what that costs. Under it, deVOL crossed the
 * 75-point `CONFIRMED_OPPORTUNITY` threshold on the strength of gaining a
 * fourth independent source, with nothing about its commercial case changed —
 * so improving discovery made the value calibration WORSE, from 25% agreement
 * with the gold set to 0%. A score that gets less truthful as the evidence
 * improves is the wrong shape.
 *
 * `docs/ORBITAL_COMMERCIAL_BENCHMARK.md` states the principle this file
 * implements: "Evidence quality and commercial value are independent, and
 * conflating them is how a well-sourced irrelevance gets sold as an
 * opportunity."
 *
 * So:
 *
 *   EVIDENCE — how well established is it that this change happened?
 *              Entirely deterministic. No researcher judgement enters it.
 *
 *   VALUE    — how much is a sale here worth pursuing, given the change?
 *              Researcher judgements plus deterministic direction and timing.
 *
 * Neither axis can subsidise the other. Evidence caps bite the evidence axis
 * only; the reasoning-hop penalty bites value only.
 *
 * NO NEW THRESHOLDS WERE INVENTED. The band boundaries (75 / 60 / 45) and the
 * reportable floor (60) are the numbers the single-axis model already used,
 * applied to each axis separately. The component weights on the value axis are
 * the existing weights unchanged, plus one new component — demand direction —
 * which is the thing every previous report found missing: nothing in the old
 * model asked whether a change increases or decreases demand for this client.
 */

import type {
  Candidate,
  Confidence,
  IsoDate,
  SignalPolarity,
} from './domain.ts';
import { assessEvidence, type EvidenceAssessment } from './evidence.ts';
import { assessFreshness, type FreshnessResult } from './freshness.ts';
import { applicableCaps, type AppliedCap, type ScoreJudgements } from './scoring.ts';
import { changeIsDated } from './dating.ts';

/* ------------------------------------------------------------------ *
 * Evidence axis
 * ------------------------------------------------------------------ */

export const EVIDENCE_MAX = {
  /** Authority of the best source, in the context of the claim's topic. */
  sourceAuthority: 40,
  /** Distinct origins. Syndicated copies of one release count once. */
  independence: 25,
  /** Whether a page was retrieved and its passage found, or only a snippet. */
  verification: 20,
  /** Whether the change has an established date at all. */
  dating: 15,
} as const;

/** Points by best tier present. Tier 1 is a registry or the company itself. */
const TIER_POINTS: Record<number, number> = { 1: 40, 2: 34, 3: 24, 4: 10, 5: 4 };

export interface EvidenceScore {
  score: number;
  raw: number;
  components: Record<keyof typeof EVIDENCE_MAX, number>;
  appliedCaps: AppliedCap[];
  assessment: EvidenceAssessment;
  explanation: string[];
}

export function scoreEvidence(candidate: Candidate): EvidenceScore {
  const assessment = assessEvidence(candidate.signal.evidence);

  const components = {
    sourceAuthority: TIER_POINTS[assessment.bestTier] ?? 4,
    independence: Math.min(
      EVIDENCE_MAX.independence,
      Math.max(0, assessment.independentSources - 1) * 8,
    ),
    verification: assessment.verification === 'page_retrieved' ? 20 : 6,
    // The CHANGE being dated, not merely a source carrying a date.
    dating: changeIsDated(candidate, assessment.hasDate) ? EVIDENCE_MAX.dating : 0,
  };

  const raw = Object.values(components).reduce((a, b) => a + b, 0);
  const appliedCaps = applicableCaps(candidate, assessment);
  const score = appliedCaps.reduce((acc, c) => Math.min(acc, c.cap), raw);

  return {
    score,
    raw,
    components,
    appliedCaps,
    assessment,
    explanation: [
      `+ source authority ${components.sourceAuthority}/${EVIDENCE_MAX.sourceAuthority} (best tier ${assessment.bestTier})`,
      `+ independence ${components.independence}/${EVIDENCE_MAX.independence} (${assessment.independentSources} independent source(s))`,
      `+ verification ${components.verification}/${EVIDENCE_MAX.verification} (${assessment.verification})`,
      `+ dating ${components.dating}/${EVIDENCE_MAX.dating} ` +
        `(${components.dating > 0 ? 'the change is dated' : 'no date established for the change'})`,
      ...appliedCaps.map((c) => `capped at ${c.cap} — ${c.reason}`),
      `= evidence ${score}/100`,
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Value axis
 * ------------------------------------------------------------------ */

export const VALUE_MAX = {
  icpFit: 25,
  signalStrength: 20,
  commercialRelevance: 15,
  /** NEW. Does this change increase or decrease demand for this client? */
  demandDirection: 15,
  /** How live the change is. Old news has already been arranged by someone. */
  timing: 15,
  /** Whether the function that owns the problem has been identified. */
  buyerIdentified: 10,
} as const;

/**
 * Direction points.
 *
 * A demand-reducing change scores zero here — it may still be a real, current,
 * well-evidenced change worth recording, but it is not worth a sales call on a
 * growth premise. `neutral`, and an absent polarity, score the midpoint rather
 * than the top: not establishing a direction is not the same as establishing
 * growth, and must not be rewarded as if it were.
 */
export function directionPoints(
  polarity: SignalPolarity | undefined,
  actionable: boolean | undefined,
): { points: number; reason: string } {
  if (actionable === false) {
    return { points: 0, reason: 'no actionable commercial consequence for this client' };
  }
  switch (polarity) {
    case 'demand_increasing':
      return { points: 15, reason: 'the change increases demand for this client’s offer' };
    case 'demand_reducing':
      return { points: 0, reason: 'the change reduces demand for this client’s offer' };
    case 'neutral':
      return { points: 7, reason: 'the change is demand-neutral for this client' };
    default:
      return { points: 7, reason: 'no direction established — scored as neutral, not as growth' };
  }
}

export interface ValueScore {
  score: number;
  raw: number;
  components: Record<keyof typeof VALUE_MAX, number>;
  penalties: { points: number; reason: string }[];
  freshness: FreshnessResult;
  explanation: string[];
}

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(Math.round(value), max));
}

export function scoreValue(
  candidate: Candidate,
  judgements: ScoreJudgements,
  runDate: IsoDate,
): ValueScore {
  const freshness = assessFreshness(candidate.signal, runDate);
  const direction = directionPoints(candidate.polarity, candidate.consequenceActionable);

  const components = {
    icpFit: clamp(judgements.icpFit, VALUE_MAX.icpFit),
    signalStrength: clamp(judgements.signalStrength, VALUE_MAX.signalStrength),
    commercialRelevance: clamp(judgements.commercialRelevance, VALUE_MAX.commercialRelevance),
    demandDirection: direction.points,
    timing: clamp(freshness.points, VALUE_MAX.timing),
    buyerIdentified: candidate.decisionMakerRole ? VALUE_MAX.buyerIdentified : 0,
  };

  const raw = Object.values(components).reduce((a, b) => a + b, 0);

  // Reasoning distance is a commercial doubt, not an evidential one: the
  // sources may be impeccable and the link to a sale still speculative.
  const penalties: { points: number; reason: string }[] = [];
  const extraInference = Math.max(0, candidate.inferenceSteps - 1);
  if (extraInference > 0) {
    penalties.push({
      points: extraInference * 10,
      reason: `${extraInference} extra inference step(s) between signal and need`,
    });
  }

  const score = Math.max(0, raw - penalties.reduce((a, p) => a + p.points, 0));

  return {
    score,
    raw,
    components,
    penalties,
    freshness,
    explanation: [
      `+ ICP fit ${components.icpFit}/${VALUE_MAX.icpFit}`,
      `+ signal strength ${components.signalStrength}/${VALUE_MAX.signalStrength}`,
      `+ commercial relevance ${components.commercialRelevance}/${VALUE_MAX.commercialRelevance}`,
      `+ demand direction ${components.demandDirection}/${VALUE_MAX.demandDirection} (${direction.reason})`,
      `+ timing ${components.timing}/${VALUE_MAX.timing} (${freshness.reason})`,
      candidate.decisionMakerRole
        ? `+ buyer identified ${components.buyerIdentified}/${VALUE_MAX.buyerIdentified} (${candidate.decisionMakerRole.function})`
        : `+ buyer identified 0/${VALUE_MAX.buyerIdentified} (function not identified)`,
      ...penalties.map((p) => `- ${p.points} ${p.reason}`),
      `= value ${score}/100`,
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Quadrants
 * ------------------------------------------------------------------ */

/** The same band boundaries the single-axis model used, per axis. */
export const BAND = { high: 75, medium: 60, low: 45 } as const;
/** The same reportable floor the single-axis model used, per axis. */
export const AXIS_FLOOR = 60;

export type Band = 'high' | 'medium' | 'low' | 'insufficient';

export function band(score: number): Band {
  if (score >= BAND.high) return 'high';
  if (score >= BAND.medium) return 'medium';
  if (score >= BAND.low) return 'low';
  return 'insufficient';
}

/**
 * The four cells of `docs/ORBITAL_COMMERCIAL_BENCHMARK.md`, named by what a
 * salesperson should do about them.
 */
export type Quadrant =
  /** High evidence, high value. Act now. */
  | 'ACT_NOW'
  /** High value, evidence not yet there. Verify before contact. */
  | 'RESEARCH_PRIORITY'
  /** Well evidenced, thin commercial case. Interesting, not worth sales time. */
  | 'LOW_VALUE'
  /** Neither. Watch, do not work. */
  | 'WATCH'
  /** Below the floor on an axis, or excluded outright. */
  | 'REJECT';

export interface TwoAxisResult {
  evidence: EvidenceScore;
  value: ValueScore;
  evidenceBand: Band;
  valueBand: Band;
  quadrant: Quadrant;
  /** True when both axes clear the floor and nothing excludes the candidate. */
  reportable: boolean;
  /**
   * True only where the engine says approach the company NOW. The benchmark
   * calls the high-evidence/low-value cell "interesting, not worth sales time"
   * and the low-evidence/high-value cell "verify before contact"; both are
   * reported, and neither is a call sheet entry.
   */
  contactRecommended: boolean;
  confidence: Confidence;
  excluded: boolean;
  exclusionReason?: string;
  explanation: string[];
}

/**
 * Confidence is a statement about the EVIDENCE, so it is read from that axis
 * alone. A confident belief in a commercially uninteresting change is still a
 * confident belief.
 */
export function axisConfidence(evidence: EvidenceScore, candidate: Candidate): Confidence {
  if (candidate.contradictions.some((c) => c.severity === 'conflicting')) return 'Low';
  if (evidence.assessment.bestTier >= 4) return 'Low';
  if (evidence.score >= BAND.high) return 'High';
  if (evidence.score >= BAND.medium) return 'Medium';
  return 'Low';
}

/**
 * The rejection rule follows the benchmark document, not convenience.
 *
 * I first wrote this as "reject unless BOTH axes clear the floor", and the
 * first run showed why that is wrong: Baltex, with a strong commercial case and
 * one syndicated source, was dropped entirely. But
 * `docs/ORBITAL_COMMERCIAL_BENCHMARK.md` — written before this milestone —
 * calls the low-evidence/high-value cell "Research priority — verify before
 * contact", and names only the low/low cell "Reject". A row worth verifying is
 * not a row to throw away.
 *
 * So: reject only when NEITHER axis clears the floor.
 */
export function quadrantOf(evidenceScore: number, valueScore: number): Quadrant {
  if (evidenceScore < AXIS_FLOOR && valueScore < AXIS_FLOOR) return 'REJECT';
  const highEvidence = evidenceScore >= BAND.high;
  const highValue = valueScore >= BAND.high;
  if (highEvidence && highValue) return 'ACT_NOW';
  if (highValue) return 'RESEARCH_PRIORITY';
  if (highEvidence) return 'LOW_VALUE';
  return 'WATCH';
}

export function scoreTwoAxis(
  candidate: Candidate,
  judgements: ScoreJudgements,
  runDate: IsoDate,
): TwoAxisResult {
  const evidence = scoreEvidence(candidate);
  const value = scoreValue(candidate, judgements, runDate);

  const fatal = candidate.contradictions.some((c) => c.severity === 'fatal');
  const excluded = fatal || value.freshness.excluded;
  const exclusionReason = fatal
    ? 'fatal contradiction'
    : value.freshness.excluded
      ? value.freshness.reason
      : undefined;

  const quadrant = excluded ? 'REJECT' : quadrantOf(evidence.score, value.score);
  const reportable = quadrant !== 'REJECT';

  return {
    evidence,
    value,
    evidenceBand: band(evidence.score),
    valueBand: band(value.score),
    quadrant,
    reportable,
    contactRecommended: quadrant === 'ACT_NOW',
    confidence: excluded ? 'Low' : axisConfidence(evidence, candidate),
    excluded,
    ...(exclusionReason ? { exclusionReason } : {}),
    explanation: [
      ...evidence.explanation,
      ...value.explanation,
      `→ ${quadrant} (evidence ${evidence.score} ${band(evidence.score)}, value ${value.score} ${band(value.score)})`,
      ...(excluded ? [`excluded: ${exclusionReason}`] : []),
    ],
  };
}

/**
 * Ranking is a commercial question, so value orders first and evidence breaks
 * ties. Under the single-axis model the order was whatever the fused number
 * happened to be, which is how a better-sourced row outranked a more valuable
 * one.
 */
export function compareTwoAxis(a: TwoAxisResult, b: TwoAxisResult): number {
  return b.value.score - a.value.score || b.evidence.score - a.evidence.score;
}

/**
 * How independent the two axes actually are across a run.
 *
 * Under one score the answer is 1 by construction. Under two it is a real
 * measurement, and a high correlation means the split has not bought anything.
 */
export function axisCorrelation(results: TwoAxisResult[]): number | null {
  if (results.length < 2) return null;
  const xs = results.map((r) => r.evidence.score);
  const ys = results.map((r) => r.value.score);
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const mx = mean(xs);
  const my = mean(ys);

  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const a = xs[i]! - mx;
    const b = ys[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}
