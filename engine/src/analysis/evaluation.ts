/**
 * Engine-versus-gold evaluation.
 *
 * Measures the engine's commercial output against an independently-labelled
 * gold set. Nothing here tunes anything: every function takes the run as it
 * happened and the labels as they were written, and reports the disagreement.
 *
 * Two deliberate choices:
 *
 *  - The gold label, not the score, decides what is correct. The engine's own
 *    score never appears on the right-hand side of a comparison.
 *  - A company the engine never researched is counted separately from one it
 *    researched and rejected. Conflating them would flatter the engine: "we
 *    never looked" is not "we looked and found nothing".
 */

import type { EngineErrorKind, GoldEntry, GoldLabel, MissReason } from '../../benchmark/gold-set.ts';

/** What the engine did with one company, extracted from a real run. */
export interface EngineOutcome {
  domain: string;
  company: string;
  /** True when the company appeared in the reported opportunity list. */
  reported: boolean;
  score?: number;
  raw?: number;
  /** 1-based position in the reported list. */
  rank?: number;
  confidence?: 'High' | 'Medium' | 'Low';
  classification?: string;
  action?: string;
  /** Set when researched and rejected: the stage that rejected it. */
  rejectedAt?: string;
  rejectionReason?: string;
  /** True when the company was never put to the engine at all. */
  researched: boolean;

  /* Two-axis fields. Absent on a single-axis run. */
  evidenceScore?: number;
  valueScore?: number;
  quadrant?: string;
  /** True when the engine says approach this company now. */
  contactRecommended?: boolean;
}

/**
 * Which gold labels describe a company a salesperson would want on the list.
 * A and B only: C is a real change with no Orbital consequence, F is a
 * plausible consequence with nothing evidencing it, and neither belongs on a
 * call sheet.
 */
export function isGenuineOpportunity(label: GoldLabel): boolean {
  return label === 'A_strong' || label === 'B_potential';
}

export interface ConfusionCounts {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  /** Genuine opportunities the engine was never asked about. */
  notResearched: number;
}

export interface EvaluationRow {
  gold: GoldEntry;
  engine: EngineOutcome | undefined;
  verdict:
    | 'true_positive'
    | 'false_positive'
    | 'false_negative'
    | 'true_negative'
    | 'not_researched';
}

export function joinRows(gold: GoldEntry[], outcomes: EngineOutcome[]): EvaluationRow[] {
  const byDomain = new Map(outcomes.map((o) => [o.domain.toLowerCase(), o]));

  return gold.map((entry) => {
    const engine = byDomain.get(entry.domain.toLowerCase());
    const wanted = isGenuineOpportunity(entry.label);
    const reported = engine?.reported ?? false;

    let verdict: EvaluationRow['verdict'];
    if (reported && wanted) verdict = 'true_positive';
    else if (reported && !wanted) verdict = 'false_positive';
    else if (!reported && wanted) {
      verdict = engine && engine.researched ? 'false_negative' : 'not_researched';
    } else verdict = 'true_negative';

    return { gold: entry, engine, verdict };
  });
}

export function confusion(rows: EvaluationRow[]): ConfusionCounts {
  const count = (v: EvaluationRow['verdict']) => rows.filter((r) => r.verdict === v).length;
  return {
    truePositives: count('true_positive'),
    falsePositives: count('false_positive'),
    falseNegatives: count('false_negative'),
    trueNegatives: count('true_negative'),
    notResearched: count('not_researched'),
  };
}

export interface Rates {
  reported: number;
  /** TP / reported — of what the engine put in front of a salesperson, how much was worth their time. */
  precision: number;
  /** FP / reported — the salesperson-facing error rate. */
  falsePositiveRate: number;
  /** FP / (FP + TN) — the classical rate, over everything that should NOT have been reported. */
  falsePositiveRateOverNegatives: number;
  /** TP / (TP + FN + notResearched) — including opportunities never put to the engine. */
  recall: number;
  /** TP / (TP + FN) — recall restricted to companies the engine actually saw. */
  recallOfResearched: number;
  missed: number;
}

export function rates(rows: EvaluationRow[]): Rates {
  const c = confusion(rows);
  const reported = c.truePositives + c.falsePositives;
  const negatives = c.falsePositives + c.trueNegatives;
  const wanted = c.truePositives + c.falseNegatives + c.notResearched;
  const seen = c.truePositives + c.falseNegatives;

  const ratio = (n: number, d: number) => (d === 0 ? 0 : n / d);

  return {
    reported,
    precision: ratio(c.truePositives, reported),
    falsePositiveRate: ratio(c.falsePositives, reported),
    falsePositiveRateOverNegatives: ratio(c.falsePositives, negatives),
    recall: ratio(c.truePositives, wanted),
    recallOfResearched: ratio(c.truePositives, seen),
    missed: c.falseNegatives + c.notResearched,
  };
}

/* ------------------------------------------------------------------ *
 * Ranking quality
 * ------------------------------------------------------------------ */

const VALUE_ORDER: Record<string, number> = { low: 0, medium: 1, high: 2 };

export interface RankingQuality {
  pairs: number;
  concordant: number;
  discordant: number;
  tied: number;
  /** Kendall tau over the comparable pairs; 1 = perfect agreement, -1 = reversed. */
  tau: number;
  /** Pairs where the engine ranked a strictly lower-value company above a higher-value one. */
  inversions: { above: string; below: string }[];
  /** True when every pair is tied on gold value — tau is then undefined and reported as 0. */
  undiscriminating: boolean;
}

/**
 * Ranking is judged against the gold VALUE grade, not the gold label, because
 * ranking is a question about commercial worth rather than about evidence.
 * Pairs tied on gold value carry no information and are excluded from tau.
 *
 * `excludeFlagged` drops rows the gold set itself marks for re-grade — labels
 * it has already recorded as unreliable. Both figures are reported, never one
 * alone: dropping a row that disagrees with the engine is exactly the move
 * that would let a benchmark flatter it.
 */
export function rankingQuality(
  rows: EvaluationRow[],
  options: { excludeFlagged?: boolean } = {},
): RankingQuality {
  const considered = options.excludeFlagged
    ? rows.filter((r) => r.gold.regradeFlag === undefined)
    : rows;
  const ranked = considered
    .filter((r) => r.engine?.reported && r.engine.rank !== undefined)
    .sort((a, b) => (a.engine!.rank ?? 0) - (b.engine!.rank ?? 0));

  let concordant = 0;
  let discordant = 0;
  let tied = 0;
  const inversions: { above: string; below: string }[] = [];

  for (let i = 0; i < ranked.length; i += 1) {
    for (let j = i + 1; j < ranked.length; j += 1) {
      const upper = ranked[i]!;
      const lower = ranked[j]!;
      const dv = VALUE_ORDER[upper.gold.value]! - VALUE_ORDER[lower.gold.value]!;
      if (dv === 0) tied += 1;
      else if (dv > 0) concordant += 1;
      else {
        discordant += 1;
        inversions.push({ above: upper.gold.company, below: lower.gold.company });
      }
    }
  }

  const comparable = concordant + discordant;
  return {
    pairs: concordant + discordant + tied,
    concordant,
    discordant,
    tied,
    tau: comparable === 0 ? 0 : (concordant - discordant) / comparable,
    inversions,
    undiscriminating: comparable === 0,
  };
}

/* ------------------------------------------------------------------ *
 * Action mix
 * ------------------------------------------------------------------ */

export interface ActionMix {
  total: number;
  byAction: Record<string, number>;
  draftOutreach: number;
  researchFurther: number;
  draftOutreachShare: number;
  researchFurtherShare: number;
  /**
   * Reported rows recommended for draft_outreach whose gold label is not A.
   * Outreach on a B is not wrong, but it is a claim the evidence does not
   * fully carry, so it is counted.
   */
  outreachOnNonStrong: string[];
}

export function actionMix(rows: EvaluationRow[]): ActionMix {
  const reported = rows.filter((r) => r.engine?.reported);
  const byAction: Record<string, number> = {};
  for (const r of reported) {
    const action = r.engine?.action ?? 'unknown';
    byAction[action] = (byAction[action] ?? 0) + 1;
  }
  const total = reported.length;
  const draft = byAction['draft_outreach'] ?? 0;
  const research = byAction['research_further'] ?? 0;

  return {
    total,
    byAction,
    draftOutreach: draft,
    researchFurther: research,
    draftOutreachShare: total === 0 ? 0 : draft / total,
    researchFurtherShare: total === 0 ? 0 : research / total,
    outreachOnNonStrong: reported
      .filter((r) => r.engine?.action === 'draft_outreach' && r.gold.label !== 'A_strong')
      .map((r) => r.gold.company),
  };
}

/* ------------------------------------------------------------------ *
 * Evidence and value agreement
 * ------------------------------------------------------------------ */

const CONFIDENCE_ORDER: Record<string, number> = { Low: 0, Medium: 1, High: 2 };

export interface Agreement {
  compared: number;
  agree: number;
  overstated: { company: string; engine: string; gold: string }[];
  understated: { company: string; engine: string; gold: string }[];
  agreementRate: number;
}

/**
 * Evidence quality: the engine's confidence against the gold evidence grade.
 * Confidence is the engine's own statement about how well-evidenced a signal
 * is, so it is the right thing to hold against an independent read of the
 * sources.
 */
export function evidenceAgreement(rows: EvaluationRow[]): Agreement {
  const compared = rows.filter((r) => r.engine?.reported && r.engine.confidence);
  const overstated: Agreement['overstated'] = [];
  const understated: Agreement['understated'] = [];
  let agree = 0;

  for (const r of compared) {
    const engine = CONFIDENCE_ORDER[r.engine!.confidence!]!;
    const gold = VALUE_ORDER[r.gold.evidence]!;
    const record = { company: r.gold.company, engine: r.engine!.confidence!, gold: r.gold.evidence };
    if (engine === gold) agree += 1;
    else if (engine > gold) overstated.push(record);
    else understated.push(record);
  }

  return {
    compared: compared.length,
    agree,
    overstated,
    understated,
    agreementRate: compared.length === 0 ? 0 : agree / compared.length,
  };
}

/**
 * Commercial value: the engine's score band against the gold value grade.
 * The bands are the engine's own classification thresholds, so this asks
 * whether the classification a salesperson reads means what it appears to.
 */
export function scoreBand(score: number): 'high' | 'medium' | 'low' {
  if (score >= 75) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

export function valueAgreement(rows: EvaluationRow[]): Agreement {
  const compared = rows.filter((r) => r.engine?.reported && r.engine.score !== undefined);
  const overstated: Agreement['overstated'] = [];
  const understated: Agreement['understated'] = [];
  let agree = 0;

  for (const r of compared) {
    const band = scoreBand(r.engine!.score!);
    const engine = VALUE_ORDER[band]!;
    const gold = VALUE_ORDER[r.gold.value]!;
    const record = { company: r.gold.company, engine: band, gold: r.gold.value };
    if (engine === gold) agree += 1;
    else if (engine > gold) overstated.push(record);
    else understated.push(record);
  }

  return {
    compared: compared.length,
    agree,
    overstated,
    understated,
    agreementRate: compared.length === 0 ? 0 : agree / compared.length,
  };
}

/* ------------------------------------------------------------------ *
 * Two-axis matrix
 * ------------------------------------------------------------------ */

export type Grade = 'high' | 'medium' | 'low';

export interface MatrixEntry {
  company: string;
  evidence: Grade;
  value: Grade;
  reported: boolean;
}

/**
 * The full 3x3 grid, not the 2x2 in the benchmark document. Collapsing medium
 * into either neighbour is the error this matrix exists to prevent: a
 * medium-value opportunity pushed into "not worth sales time" reads as a
 * verdict the gold set never gave.
 */
export function twoAxisMatrix(rows: EvaluationRow[]): MatrixEntry[] {
  return rows.map((r) => ({
    company: r.gold.company,
    evidence: r.gold.evidence,
    value: r.gold.value,
    reported: r.engine?.reported ?? false,
  }));
}

export function matrixCell(
  matrix: MatrixEntry[],
  evidence: Grade,
  value: Grade,
): MatrixEntry[] {
  return matrix.filter((m) => m.evidence === evidence && m.value === value);
}

/* ------------------------------------------------------------------ *
 * Two-axis agreement
 * ------------------------------------------------------------------ */

/** The band boundaries the two-axis model uses, restated for the evaluator. */
export function axisBand(score: number): 'high' | 'medium' | 'low' {
  if (score >= 75) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

/**
 * Agreement between an axis score and the gold grade for that axis.
 *
 * This is the measurement the single-axis model could not make honestly: with
 * one number, "how well proven" and "how much worth pursuing" were compared
 * against the same figure, so improving one appeared to improve both.
 */
export function axisAgreement(
  rows: EvaluationRow[],
  axis: 'evidence' | 'value',
): Agreement {
  const compared = rows.filter((r) => {
    const score = axis === 'evidence' ? r.engine?.evidenceScore : r.engine?.valueScore;
    return r.engine?.reported && score !== undefined;
  });

  const overstated: Agreement['overstated'] = [];
  const understated: Agreement['understated'] = [];
  let agree = 0;

  for (const r of compared) {
    const score = (axis === 'evidence' ? r.engine!.evidenceScore : r.engine!.valueScore)!;
    const engineBand = axisBand(score);
    const goldGrade = axis === 'evidence' ? r.gold.evidence : r.gold.value;
    const record = { company: r.gold.company, engine: `${engineBand} (${score})`, gold: goldGrade };

    if (VALUE_ORDER[engineBand]! === VALUE_ORDER[goldGrade]!) agree += 1;
    else if (VALUE_ORDER[engineBand]! > VALUE_ORDER[goldGrade]!) overstated.push(record);
    else understated.push(record);
  }

  return {
    compared: compared.length,
    agree,
    overstated,
    understated,
    agreementRate: compared.length === 0 ? 0 : agree / compared.length,
  };
}

export interface ContactRates {
  /** Rows the engine recommends approaching now. */
  contacts: number;
  /** Of those, how many the gold set calls a genuine opportunity. */
  correct: number;
  /** Precision over the call sheet, rather than over everything reported. */
  contactPrecision: number;
  /** Genuine opportunities reported but held back from contact. */
  heldBack: string[];
  /** Non-opportunities reported and correctly held back from contact. */
  correctlyHeldBack: string[];
}

/**
 * Precision over the call sheet.
 *
 * Reporting a row and putting it in front of a salesperson are different acts,
 * and the two-axis model separates them: the low-value and unverified cells are
 * reported without being recommended for contact. Both numbers are given so the
 * separation cannot be used to flatter the engine.
 */
export function contactRates(rows: EvaluationRow[]): ContactRates {
  const contacts = rows.filter((r) => r.engine?.contactRecommended);
  const correct = contacts.filter((r) => isGenuineOpportunity(r.gold.label));
  const reportedNotContacted = rows.filter(
    (r) => r.engine?.reported && !r.engine.contactRecommended,
  );

  return {
    contacts: contacts.length,
    correct: correct.length,
    contactPrecision: contacts.length === 0 ? 0 : correct.length / contacts.length,
    heldBack: reportedNotContacted
      .filter((r) => isGenuineOpportunity(r.gold.label))
      .map((r) => r.gold.company),
    correctlyHeldBack: reportedNotContacted
      .filter((r) => !isGenuineOpportunity(r.gold.label))
      .map((r) => r.gold.company),
  };
}

/* ------------------------------------------------------------------ *
 * Failure accounting
 * ------------------------------------------------------------------ */

export interface FailureCounts {
  missesByReason: Record<string, number>;
  errorsByKind: Record<string, number>;
  /** Every recorded engine error, with the company it was found on. */
  errors: { company: string; kind: EngineErrorKind; detail: string }[];
  misses: { company: string; label: GoldLabel; reason: MissReason }[];
}

export function failures(rows: EvaluationRow[]): FailureCounts {
  const missesByReason: Record<string, number> = {};
  const errorsByKind: Record<string, number> = {};
  const errors: FailureCounts['errors'] = [];
  const misses: FailureCounts['misses'] = [];

  for (const r of rows) {
    if (r.gold.missReason) {
      missesByReason[r.gold.missReason] = (missesByReason[r.gold.missReason] ?? 0) + 1;
      misses.push({ company: r.gold.company, label: r.gold.label, reason: r.gold.missReason });
    }
    for (const err of r.gold.engineErrors ?? []) {
      errorsByKind[err.kind] = (errorsByKind[err.kind] ?? 0) + 1;
      errors.push({ company: r.gold.company, kind: err.kind, detail: err.detail });
    }
  }

  return { missesByReason, errorsByKind, errors, misses };
}

/* ------------------------------------------------------------------ *
 * The whole evaluation
 * ------------------------------------------------------------------ */

export interface Evaluation {
  rows: EvaluationRow[];
  confusion: ConfusionCounts;
  rates: Rates;
  ranking: RankingQuality;
  actions: ActionMix;
  evidence: Agreement;
  value: Agreement;
  matrix: MatrixEntry[];
  failures: FailureCounts;
  /** Present when the run scored on two axes. */
  axes?: {
    evidence: Agreement;
    value: Agreement;
    contact: ContactRates;
  };
}

export function evaluate(gold: GoldEntry[], outcomes: EngineOutcome[]): Evaluation {
  const rows = joinRows(gold, outcomes);
  const twoAxis = outcomes.some((o) => o.valueScore !== undefined);

  return {
    ...(twoAxis
      ? {
          axes: {
            evidence: axisAgreement(rows, 'evidence'),
            value: axisAgreement(rows, 'value'),
            contact: contactRates(rows),
          },
        }
      : {}),
    rows,
    confusion: confusion(rows),
    rates: rates(rows),
    ranking: rankingQuality(rows),
    actions: actionMix(rows),
    evidence: evidenceAgreement(rows),
    value: valueAgreement(rows),
    matrix: twoAxisMatrix(rows),
    failures: failures(rows),
  };
}
