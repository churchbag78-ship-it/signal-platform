/**
 * Commercial reasoning measurement — separate from evidence measurement.
 *
 * A signal can be perfectly sourced and still say nothing a salesperson can
 * use. These functions test the reasoning itself:
 *
 *   1. Is the commercial consequence SPECIFIC, or is it "they may need
 *      logistics"? That failure mode is the reason this file exists.
 *   2. Does the chain actually reach three levels — direct signal, second-order
 *      consequence, third-order question — with the third stated as a question
 *      rather than answered?
 *
 * Nothing here repairs anything. It measures and reports.
 */

import type { Claim, Fact, Hypothesis } from '../domain.ts';

/* ------------------------------------------------------------------ *
 * Generic-logistics detection
 * ------------------------------------------------------------------ */

/**
 * Phrasings that assert a logistics need without naming a mechanism. Each is
 * a construction that would remain true if the company, the change and the
 * cargo were all swapped for different ones — which is exactly what makes it
 * worthless to a salesperson.
 */
export const GENERIC_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bmay (?:well )?need (?:more )?logistics\b/i, label: 'may need logistics' },
  { pattern: /\blogistics (?:opportunit(?:y|ies)|requirements?|needs?)\b/i, label: 'logistics opportunities/needs' },
  { pattern: /\bcould benefit from (?:a )?(?:freight|logistics|shipping|3pl)\b/i, label: 'could benefit from freight' },
  { pattern: /\b(?:increased|more|additional|growing) (?:shipping|freight|logistics) (?:needs|requirements|demand)\b/i, label: 'increased shipping needs' },
  { pattern: /\bwill need (?:to move|to ship) (?:more )?(?:goods|product|stock)\b/i, label: 'will need to move goods' },
  { pattern: /\bsupply chain (?:challenges|pressures|needs)\b/i, label: 'supply chain challenges' },
  { pattern: /\blooking for a (?:logistics|freight) partner\b/i, label: 'looking for a partner' },
  { pattern: /\bpotential(?:ly)? (?:new )?(?:freight|logistics) (?:spend|business)\b/i, label: 'potential freight spend' },
];

/**
 * Markers that a consequence is anchored to something a salesperson can check.
 * Presence is not proof of a good argument, but absence of ALL of them means
 * the text asserts a need without naming what creates it.
 */
export interface SpecificityMarkers {
  /** A named place, lane or market. */
  namedGeography: boolean;
  /** A quantity, percentage, currency figure or multiple. */
  namedQuantity: boolean;
  /** A named cargo characteristic or regulatory regime. */
  namedCargoOrRegime: boolean;
  /** A named service Orbital sells, rather than "logistics" in general. */
  namedService: boolean;
  /** A date or explicit timing. */
  namedTiming: boolean;
}

const GEOGRAPHY =
  /\b(US|USA|United States|California|Germany|France|Poland|Denmark|Thailand|China|Sweden|Finland|Norway|Netherlands|Ireland|EU|Europe|UK|Zambia|Ghana|Africa|Taiwan|Nordics?|Scandinavia)\b/;
const QUANTITY = /(£|\$|€)\s?[\d.,]+\s?(m|bn|k|million|billion)?|\b\d+(\.\d+)?\s?%|\b(two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|fivefold|tenfold|double|triple)\b|\b\d[\d,]*\s?(sq ft|units|jobs|roles|tonnes|pallets|containers)\b/i;
const CARGO_REGIME =
  /\b(Class 9|UN3480|UN3481|dangerous goods|DG|lithium|hazardous|ADR|IATA|customs|tariffs?|incoterms?|export documentation|certificate of origin|aerospace|traceab)/i;
const SERVICE =
  /\b(groupage|consolidat|export packing|crat|freight forward|customs clearance|same-day|courier|haulage|warehous|fulfilment|FBA|cargo insurance|project cargo|oversized|air freight|sea freight|road freight)/i;
const TIMING =
  /\b(20\d\d|January|February|March|April|May|June|July|August|September|October|November|December|this year|year on year|peak|Q[1-4]|quarter)\b/i;

export function markers(text: string): SpecificityMarkers {
  return {
    namedGeography: GEOGRAPHY.test(text),
    namedQuantity: QUANTITY.test(text),
    namedCargoOrRegime: CARGO_REGIME.test(text),
    namedService: SERVICE.test(text),
    namedTiming: TIMING.test(text),
  };
}

export interface SpecificityResult {
  /** Generic phrasings found, by label. */
  generic: string[];
  markers: SpecificityMarkers;
  markerCount: number;
  /**
   * `generic` — asserts a need without naming what creates it.
   * `thin` — no generic phrasing but fewer than two anchors.
   * `specific` — two or more independent anchors and no generic phrasing.
   */
  verdict: 'generic' | 'thin' | 'specific';
}

export function assessSpecificity(text: string): SpecificityResult {
  const generic = GENERIC_PATTERNS.filter((g) => g.pattern.test(text)).map((g) => g.label);
  const m = markers(text);
  const markerCount = Object.values(m).filter(Boolean).length;

  const verdict: SpecificityResult['verdict'] =
    generic.length > 0 ? 'generic' : markerCount >= 2 ? 'specific' : 'thin';

  return { generic, markers: m, markerCount, verdict };
}

/* ------------------------------------------------------------------ *
 * Reasoning depth
 * ------------------------------------------------------------------ */

export interface ReasoningDepth {
  /** Level 1 — what a source states. */
  directSignal: boolean;
  /** Level 2 — what that plausibly changes. */
  secondOrder: boolean;
  /** Level 3 — the question a salesperson must ask. */
  thirdOrderQuestion: boolean;
  /** True when level 3 is phrased as an answer rather than a question. */
  answersItsOwnQuestion: boolean;
  factCount: number;
  inferenceCount: number;
  levels: number;
}

const QUESTION_FORM =
  /\b(ask|confirm|check|establish|find out|verify|whether|who|when|what|how much|does|is it)\b/i;

/**
 * The hypothesis must remain a hypothesis. If its test is not a question — if
 * it restates the conclusion — the chain has answered level three instead of
 * posing it, which is the failure the benchmark warns against.
 */
export function assessReasoningDepth(claims: Claim[], hypothesis: Hypothesis): ReasoningDepth {
  const facts = claims.filter((c): c is Fact => c.kind === 'fact');
  const inferences = claims.filter((c) => c.kind === 'inference');
  const test = hypothesis.testableBy ?? '';
  const isQuestion = QUESTION_FORM.test(test) || test.trim().endsWith('?');

  const directSignal = facts.length > 0;
  const secondOrder = inferences.length > 0;
  const thirdOrderQuestion = test.trim().length > 0 && isQuestion;

  return {
    directSignal,
    secondOrder,
    thirdOrderQuestion,
    answersItsOwnQuestion: test.trim().length > 0 && !isQuestion,
    factCount: facts.length,
    inferenceCount: inferences.length,
    levels: [directSignal, secondOrder, thirdOrderQuestion].filter(Boolean).length,
  };
}

/* ------------------------------------------------------------------ *
 * Combined per-signal assessment
 * ------------------------------------------------------------------ */

export interface ReasoningAssessment {
  company: string;
  hypothesis: SpecificityResult;
  salesAngle: SpecificityResult;
  whyNow: SpecificityResult;
  consequence: SpecificityResult;
  depth: ReasoningDepth;
  /** True when every reasoning surface a salesperson reads is specific. */
  passes: boolean;
}

export function assessReasoning(input: {
  company: string;
  claims: Claim[];
  hypothesis: Hypothesis;
  salesAngle: string;
  whyNow: string;
  consequence: string;
}): ReasoningAssessment {
  const hypothesis = assessSpecificity(input.hypothesis.statement);
  const salesAngle = assessSpecificity(input.salesAngle);
  const whyNow = assessSpecificity(input.whyNow);
  const consequence = assessSpecificity(input.consequence);
  const depth = assessReasoningDepth(input.claims, input.hypothesis);

  return {
    company: input.company,
    hypothesis,
    salesAngle,
    whyNow,
    consequence,
    depth,
    passes:
      depth.levels === 3 &&
      !depth.answersItsOwnQuestion &&
      [hypothesis, salesAngle, whyNow, consequence].every((s) => s.verdict === 'specific'),
  };
}
